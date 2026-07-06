#![no_std]
//! Prism Agent Treasury
//!
//! A non-custodial treasury that lets a business delegate spending to an AI agent
//! while the *contract* — not the model's good behaviour — enforces hard limits.
//! Every payment is checked against a policy (payee whitelist, per-task limit,
//! daily limit) and rejected on-chain if it violates the policy. Spend is
//! accounted per task so each agent payment is automatically attributable.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, token,
    Address, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    PayeeNotWhitelisted = 2,
    ExceedsTaskLimit = 3,
    ExceedsDailyLimit = 4,
    BelowReputationThreshold = 5,
    InsufficientFreeBalance = 6,
    EscrowNotFound = 7,
    DeadlineNotReached = 8,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    /// Owner of the funds; the only one who can change the policy.
    pub admin: Address,
    /// The agent allowed to trigger payments (must sign each `pay`).
    pub agent: Address,
    /// SEP-41 / SAC token the treasury holds and spends (e.g. USDC).
    pub token: Address,
    /// Max total spend allowed per UTC calendar day (resets at 00:00 UTC).
    pub daily_limit: i128,
    /// Max spend allowed in a single payment.
    pub per_task_limit: i128,
}

/// An outcome-bound payment: `amount` is reserved (locked) in the treasury for
/// `payee` against `task_id`, releasable on approval or refundable after `deadline`
/// (UNIX seconds). The funds never leave until release — refund just unlocks them.
#[contracttype]
#[derive(Clone)]
pub struct Escrow {
    pub payee: Address,
    pub amount: i128,
    pub task_id: u64,
    pub deadline: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Payee(Address),
    DaySpent(u64),
    TaskSpent(u64),
    RepRegistry,
    MinReputation,
    EscrowEntry(u64),
    NextEscrowId,
    Locked,
}

/// Minimal reputation-oracle interface PRISM reads to authorize a *non-whitelisted*
/// payee by its earned trust. Targets an ERC-8004-style reputation registry
/// (e.g. stellar-8004). `reputation_of` returns an opaque, monotonic score where
/// a higher value means more trustworthy.
#[contractclient(name = "ReputationClient")]
pub trait ReputationOracle {
    fn reputation_of(env: Env, agent: Address) -> i128;
}

const SECONDS_PER_DAY: u64 = 86_400;

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    /// Atomic init at deploy time (no front-runnable `initialize`).
    pub fn __constructor(
        env: Env,
        admin: Address,
        agent: Address,
        token: Address,
        daily_limit: i128,
        per_task_limit: i128,
    ) {
        let cfg = Config {
            admin,
            agent,
            token,
            daily_limit,
            per_task_limit,
        };
        env.storage().instance().set(&DataKey::Config, &cfg);
    }

    /// Whitelist a payee. Admin-only.
    pub fn add_payee(env: Env, payee: Address) {
        let cfg = Self::cfg(&env);
        cfg.admin.require_auth();
        env.storage().persistent().set(&DataKey::Payee(payee), &true);
    }

    /// Remove a payee from the whitelist. Admin-only.
    pub fn remove_payee(env: Env, payee: Address) {
        let cfg = Self::cfg(&env);
        cfg.admin.require_auth();
        env.storage().persistent().remove(&DataKey::Payee(payee));
    }

    /// Set (or update) the reputation gate. Admin-only. With `min_reputation > 0`,
    /// a payee that is NOT on the whitelist can still be paid when its score from
    /// `registry` is >= `min_reputation` — turning the static allowlist into an
    /// earned-trust gate. Set `min_reputation = 0` to disable (whitelist-only).
    pub fn set_reputation_policy(env: Env, registry: Address, min_reputation: i128) {
        let cfg = Self::cfg(&env);
        cfg.admin.require_auth();
        env.storage().instance().set(&DataKey::RepRegistry, &registry);
        env.storage()
            .instance()
            .set(&DataKey::MinReputation, &min_reputation);
    }

    /// The active reputation gate, if any: `(registry, min_reputation)`.
    pub fn get_reputation_policy(env: Env) -> Option<(Address, i128)> {
        let registry: Option<Address> = env.storage().instance().get(&DataKey::RepRegistry);
        let min = env
            .storage()
            .instance()
            .get(&DataKey::MinReputation)
            .unwrap_or(0_i128);
        registry.map(|r| (r, min))
    }

    /// The agent asks the treasury to pay `amount` to `to` for `task_id`.
    /// The contract enforces the policy and rejects any violation on-chain.
    /// Only the free (unlocked) balance is spendable — funds reserved by open
    /// escrows cannot be paid out directly.
    pub fn pay(env: Env, task_id: u64, to: Address, amount: i128) -> Result<(), Error> {
        let cfg = Self::cfg(&env);
        cfg.agent.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // ---- POLICY GATE ----------------------------------------------------
        // Payee must be on the manual whitelist OR (opt-in) earn a high-enough
        // reputation score from the configured ERC-8004 registry. Default: whitelist only.
        Self::payee_allowed(&env, &to)?;
        if amount > cfg.per_task_limit {
            return Err(Error::ExceedsTaskLimit);
        }
        let day = env.ledger().timestamp() / SECONDS_PER_DAY;
        let spent_today = Self::day_spent_on(&env, day);
        if spent_today + amount > cfg.daily_limit {
            return Err(Error::ExceedsDailyLimit);
        }
        let locked = Self::locked(env.clone());
        if Self::balance(env.clone()) - locked < amount {
            return Err(Error::InsufficientFreeBalance);
        }
        // ---------------------------------------------------------------------

        // ---- EFFECTS: record the spend BEFORE moving funds (checks-effects-interactions).
        // per-day enforces the daily limit; per-task is the attribution ledger.
        let task_spent = Self::task_spent(env.clone(), task_id);
        env.storage()
            .persistent()
            .set(&DataKey::DaySpent(day), &(spent_today + amount));
        env.storage()
            .persistent()
            .set(&DataKey::TaskSpent(task_id), &(task_spent + amount));

        // ---- INTERACTION: move the treasury's own balance out last. If the transfer
        // panics, the whole tx reverts and the accounting above is rolled back atomically.
        token::TokenClient::new(&env, &cfg.token).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );

        env.events()
            .publish((symbol_short!("paid"), task_id), (to, amount));
        Ok(())
    }

    // ---- views -------------------------------------------------------------

    pub fn get_config(env: Env) -> Config {
        Self::cfg(&env)
    }

    pub fn is_payee(env: Env, payee: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Payee(payee))
            .unwrap_or(false)
    }

    pub fn task_spent(env: Env, task_id: u64) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TaskSpent(task_id))
            .unwrap_or(0)
    }

    pub fn day_spent(env: Env) -> i128 {
        let day = env.ledger().timestamp() / SECONDS_PER_DAY;
        Self::day_spent_on(&env, day)
    }

    pub fn balance(env: Env) -> i128 {
        let cfg = Self::cfg(&env);
        token::TokenClient::new(&env, &cfg.token).balance(&env.current_contract_address())
    }

    // ---- escrow: outcome-bound payments ------------------------------------

    /// Agent reserves `amount` for `payee` against a future-delivered task. The funds
    /// stay in the treasury (locked, not transferred) until released on approval or
    /// refunded after `deadline`. Subject to the same payee gate + per-task limit as
    /// a direct payment; the daily limit is enforced later, at release.
    pub fn create_escrow(
        env: Env,
        task_id: u64,
        payee: Address,
        amount: i128,
        deadline: u64,
    ) -> Result<u64, Error> {
        let cfg = Self::cfg(&env);
        cfg.agent.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::payee_allowed(&env, &payee)?;
        if amount > cfg.per_task_limit {
            return Err(Error::ExceedsTaskLimit);
        }
        let locked = Self::locked(env.clone());
        if Self::balance(env.clone()) - locked < amount {
            return Err(Error::InsufficientFreeBalance);
        }

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextEscrowId)
            .unwrap_or(0);
        let escrow = Escrow {
            payee: payee.clone(),
            amount,
            task_id,
            deadline,
        };
        env.storage()
            .persistent()
            .set(&DataKey::EscrowEntry(id), &escrow);
        env.storage().instance().set(&DataKey::NextEscrowId, &(id + 1));
        env.storage().instance().set(&DataKey::Locked, &(locked + amount));

        env.events()
            .publish((symbol_short!("escrowed"), id), (payee, amount));
        Ok(id)
    }

    /// Admin (the owner / hirer) approves delivery → release the locked funds to the
    /// payee. The daily limit is enforced here, at the real moment of outflow, and
    /// the spend is accounted per task exactly like a direct `pay`.
    pub fn release_escrow(env: Env, id: u64) -> Result<(), Error> {
        let cfg = Self::cfg(&env);
        cfg.admin.require_auth();
        let escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::EscrowEntry(id))
            .ok_or(Error::EscrowNotFound)?;

        let day = env.ledger().timestamp() / SECONDS_PER_DAY;
        let spent_today = Self::day_spent_on(&env, day);
        if spent_today + escrow.amount > cfg.daily_limit {
            return Err(Error::ExceedsDailyLimit);
        }

        // EFFECTS before INTERACTION (checks-effects-interactions): record spend,
        // drop the escrow, and release the lock, then move funds out last.
        let task_spent = Self::task_spent(env.clone(), escrow.task_id);
        env.storage()
            .persistent()
            .set(&DataKey::DaySpent(day), &(spent_today + escrow.amount));
        env.storage()
            .persistent()
            .set(&DataKey::TaskSpent(escrow.task_id), &(task_spent + escrow.amount));
        env.storage().persistent().remove(&DataKey::EscrowEntry(id));
        env.storage()
            .instance()
            .set(&DataKey::Locked, &(Self::locked(env.clone()) - escrow.amount));

        token::TokenClient::new(&env, &cfg.token).transfer(
            &env.current_contract_address(),
            &escrow.payee,
            &escrow.amount,
        );
        env.events()
            .publish((symbol_short!("released"), id), (escrow.payee, escrow.amount));
        Ok(())
    }

    /// After the deadline, the agent reclaims an undelivered escrow — the lock is
    /// released back to the treasury's free balance. No transfer, no spend recorded.
    pub fn refund_escrow(env: Env, id: u64) -> Result<(), Error> {
        let cfg = Self::cfg(&env);
        cfg.agent.require_auth();
        let escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::EscrowEntry(id))
            .ok_or(Error::EscrowNotFound)?;

        if env.ledger().timestamp() < escrow.deadline {
            return Err(Error::DeadlineNotReached);
        }
        env.storage().persistent().remove(&DataKey::EscrowEntry(id));
        env.storage()
            .instance()
            .set(&DataKey::Locked, &(Self::locked(env.clone()) - escrow.amount));

        env.events()
            .publish((symbol_short!("refunded"), id), (escrow.payee, escrow.amount));
        Ok(())
    }

    pub fn get_escrow(env: Env, id: u64) -> Option<Escrow> {
        env.storage().persistent().get(&DataKey::EscrowEntry(id))
    }

    /// Total funds currently reserved by open escrows (treasury balance minus this
    /// is the spendable free balance).
    pub fn locked(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Locked).unwrap_or(0)
    }
}

// Non-exported helpers (separate impl block so they are not part of the ABI).
impl Treasury {
    fn cfg(env: &Env) -> Config {
        env.storage().instance().get(&DataKey::Config).unwrap()
    }

    /// Whitelist OR earned-reputation gate. See `set_reputation_policy`.
    fn payee_allowed(env: &Env, to: &Address) -> Result<(), Error> {
        if Self::is_payee(env.clone(), to.clone()) {
            return Ok(());
        }
        let registry: Option<Address> = env.storage().instance().get(&DataKey::RepRegistry);
        let min: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MinReputation)
            .unwrap_or(0);
        match registry {
            Some(reg) if min > 0 => {
                let score = ReputationClient::new(env, &reg).reputation_of(to);
                if score >= min {
                    Ok(())
                } else {
                    Err(Error::BelowReputationThreshold)
                }
            }
            _ => Err(Error::PayeeNotWhitelisted),
        }
    }

    fn day_spent_on(env: &Env, day: u64) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::DaySpent(day))
            .unwrap_or(0)
    }
}

mod test;
