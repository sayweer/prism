#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal,
};

/// Deploy a fresh treasury + test token (funded with 500 units) and return the
/// handles the tests need. `daily_limit` / `per_task_limit` go to the constructor.
fn setup<'a>(
    env: &'a Env,
    daily_limit: i128,
    per_task_limit: i128,
) -> (Address, TreasuryClient<'a>, TokenClient<'a>) {
    let admin = Address::generate(env);
    let agent = Address::generate(env);
    let payee = Address::generate(env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = StellarAssetClient::new(env, &token_addr);
    let token = TokenClient::new(env, &token_addr);

    let id = env.register(
        Treasury,
        (admin, agent, token_addr, daily_limit, per_task_limit),
    );
    let client = TreasuryClient::new(env, &id);
    token_admin.mint(&id, &500_i128);

    (payee, client, token)
}

#[test]
fn pay_accounting_and_rejections() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let payee = Address::generate(&env);
    let attacker = Address::generate(&env);

    // Deploy a test token (Stellar Asset Contract) with `admin` as issuer.
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_addr);
    let token = TokenClient::new(&env, &token_addr);

    // Deploy the treasury: daily_limit = 1000, per_task_limit = 100.
    let id = env.register(
        Treasury,
        (
            admin.clone(),
            agent.clone(),
            token_addr.clone(),
            1000_i128,
            100_i128,
        ),
    );
    let client = TreasuryClient::new(&env, &id);

    // Fund the treasury with 500 units.
    token_admin.mint(&id, &500_i128);
    assert_eq!(client.balance(), 500);

    // Whitelist the payee.
    client.add_payee(&payee);
    assert!(client.is_payee(&payee));

    // Legit payment within limits.
    client.pay(&1_u64, &payee, &50_i128);
    assert_eq!(token.balance(&payee), 50);
    assert_eq!(client.task_spent(&1), 50);
    assert_eq!(client.day_spent(), 50);

    // Reject: recipient not whitelisted (the "rogue / prompt-injected" case).
    assert_eq!(
        client.try_pay(&2_u64, &attacker, &10_i128),
        Err(Ok(Error::PayeeNotWhitelisted))
    );
    assert_eq!(token.balance(&attacker), 0);

    // Reject: exceeds per-task limit.
    assert_eq!(
        client.try_pay(&3_u64, &payee, &200_i128),
        Err(Ok(Error::ExceedsTaskLimit))
    );

    // Second valid payment accumulates daily + task spend.
    client.pay(&1_u64, &payee, &30_i128);
    assert_eq!(client.task_spent(&1), 80);
    assert_eq!(client.day_spent(), 80);
}

/// The daily limit is enforced even when each individual payment is within the
/// per-task limit. (This path — Error #4 — was previously untested.)
#[test]
fn exceeds_daily_limit_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 100_i128, 60_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &60_i128);
    assert_eq!(client.day_spent(), 60);

    // 50 is within per-task (60) but would push the day to 110 > 100 → rejected.
    assert_eq!(
        client.try_pay(&2_u64, &payee, &50_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );

    // Hitting the daily limit exactly (60 + 40 = 100) is still allowed.
    client.pay(&3_u64, &payee, &40_i128);
    assert_eq!(client.day_spent(), 100);
    assert_eq!(token.balance(&payee), 100);
}

/// The daily counter is keyed by UTC day, so it resets when the ledger crosses
/// a day boundary. (Documents the calendar-day semantics explicitly.)
#[test]
fn daily_limit_resets_on_new_utc_day() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 100_i128, 100_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &100_i128);
    assert_eq!(client.day_spent(), 100);
    assert_eq!(
        client.try_pay(&2_u64, &payee, &1_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );

    // Advance the ledger one full UTC day; a fresh day key means a fresh allowance.
    env.ledger().with_mut(|li| li.timestamp = SECONDS_PER_DAY);
    client.pay(&3_u64, &payee, &100_i128);
    assert_eq!(client.day_spent(), 100);
    assert_eq!(token.balance(&payee), 200);
}

/// Once a payee is removed from the whitelist, payments to it are rejected.
#[test]
fn rejects_payment_after_payee_removed() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &10_i128);

    client.remove_payee(&payee);
    assert!(!client.is_payee(&payee));
    assert_eq!(
        client.try_pay(&2_u64, &payee, &10_i128),
        Err(Ok(Error::PayeeNotWhitelisted))
    );
}

/// Zero and negative amounts are rejected before any transfer is attempted.
#[test]
fn rejects_zero_and_negative_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    client.add_payee(&payee);
    assert_eq!(
        client.try_pay(&1_u64, &payee, &0_i128),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_pay(&2_u64, &payee, &-5_i128),
        Err(Ok(Error::InvalidAmount))
    );
}

/// A payment exactly at the per-task limit is allowed; one unit over is rejected.
#[test]
fn per_task_limit_boundary() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &100_i128);
    assert_eq!(token.balance(&payee), 100);
    assert_eq!(
        client.try_pay(&2_u64, &payee, &101_i128),
        Err(Ok(Error::ExceedsTaskLimit))
    );
}

// --- reputation gate (ERC-8004-style) ------------------------------------------

/// A minimal mock of an ERC-8004 reputation registry: stores a score per agent.
#[contract]
pub struct MockReputation;

#[contractimpl]
impl MockReputation {
    pub fn set_score(env: Env, agent: Address, score: i128) {
        env.storage().persistent().set(&agent, &score);
    }
    pub fn reputation_of(env: Env, agent: Address) -> i128 {
        env.storage().persistent().get(&agent).unwrap_or(0)
    }
}

/// A non-whitelisted payee can be paid once it clears the reputation threshold.
#[test]
fn reputation_gated_payee_allowed() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, token) = setup(&env, 1000_i128, 100_i128);

    let rep_id = env.register(MockReputation, ());
    let rep = MockReputationClient::new(&env, &rep_id);

    // a brand-new agent, NOT on the whitelist, but reputable
    let reputable = Address::generate(&env);
    rep.set_score(&reputable, &80_i128);

    // turn on the gate: min reputation = 50
    client.set_reputation_policy(&rep_id, &50_i128);
    assert_eq!(client.get_reputation_policy(), Some((rep_id.clone(), 50_i128)));

    // pays even though `reputable` was never whitelisted
    client.pay(&1_u64, &reputable, &40_i128);
    assert_eq!(token.balance(&reputable), 40);
}

/// Below the reputation threshold (and not whitelisted) → rejected.
#[test]
fn below_reputation_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    let rep_id = env.register(MockReputation, ());
    let rep = MockReputationClient::new(&env, &rep_id);

    let shady = Address::generate(&env);
    rep.set_score(&shady, &10_i128);

    client.set_reputation_policy(&rep_id, &50_i128);

    assert_eq!(
        client.try_pay(&1_u64, &shady, &10_i128),
        Err(Ok(Error::BelowReputationThreshold))
    );
}

/// A whitelisted payee is always allowed — whitelist OR reputation, either suffices.
#[test]
fn whitelisted_payee_bypasses_reputation() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);

    // gate on, but `payee` has score 0 in the mock — the whitelist still lets it through
    let rep_id = env.register(MockReputation, ());
    client.set_reputation_policy(&rep_id, &50_i128);

    client.add_payee(&payee);
    client.pay(&1_u64, &payee, &25_i128);
    assert_eq!(token.balance(&payee), 25);
}

// --- escrow: outcome-bound payments --------------------------------------------

/// Lock funds for a payee, then release on approval: payee paid, spend accounted,
/// lock cleared, funds only move at release.
#[test]
fn escrow_lock_and_release() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&7_u64, &payee, &60_i128, &SECONDS_PER_DAY);
    assert_eq!(client.locked(), 60);
    assert_eq!(client.balance(), 500); // reserved, not yet moved
    assert_eq!(token.balance(&payee), 0);

    client.release_escrow(&id);
    assert_eq!(token.balance(&payee), 60);
    assert_eq!(client.day_spent(), 60);
    assert_eq!(client.task_spent(&7), 60);
    assert_eq!(client.locked(), 0);
    assert!(client.get_escrow(&id).is_none());
}

/// After the deadline, the agent reclaims an undelivered escrow — funds unlock,
/// nothing is paid out.
#[test]
fn escrow_refund_after_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&1_u64, &payee, &80_i128, &SECONDS_PER_DAY);
    assert_eq!(client.locked(), 80);

    env.ledger().with_mut(|li| li.timestamp = SECONDS_PER_DAY); // reach the deadline
    client.refund_escrow(&id);

    assert_eq!(client.locked(), 0);
    assert_eq!(token.balance(&payee), 0);
    assert_eq!(client.balance(), 500); // funds stayed in the treasury
    assert!(client.get_escrow(&id).is_none());
}

/// Refunding before the deadline is rejected.
#[test]
fn escrow_refund_before_deadline_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&1_u64, &payee, &80_i128, &SECONDS_PER_DAY);
    assert_eq!(
        client.try_refund_escrow(&id),
        Err(Ok(Error::DeadlineNotReached))
    );
}

/// Escrow creation honors the same payee gate + per-task limit as a direct payment.
#[test]
fn escrow_create_enforces_per_task_and_payee() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    // not whitelisted (no reputation policy) → rejected
    assert_eq!(
        client.try_create_escrow(&1_u64, &payee, &50_i128, &SECONDS_PER_DAY),
        Err(Ok(Error::PayeeNotWhitelisted))
    );

    client.add_payee(&payee);
    // over the per-task limit (100) → rejected
    assert_eq!(
        client.try_create_escrow(&2_u64, &payee, &101_i128, &SECONDS_PER_DAY),
        Err(Ok(Error::ExceedsTaskLimit))
    );
}

/// Cannot lock more than the free balance (treasury balance minus already-locked).
#[test]
fn escrow_insufficient_free_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 500_i128);
    client.add_payee(&payee);

    client.create_escrow(&1_u64, &payee, &400_i128, &SECONDS_PER_DAY); // locks 400 → free 100
    assert_eq!(
        client.try_create_escrow(&2_u64, &payee, &200_i128, &SECONDS_PER_DAY),
        Err(Ok(Error::InsufficientFreeBalance))
    );
}

/// pay() must not spend funds reserved by open escrows — the free-balance
/// invariant (balance >= locked) holds on the direct-pay path too, so an
/// accepted escrow can always be honored at release.
#[test]
fn pay_cannot_spend_escrow_locked_funds() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 500_i128);
    client.add_payee(&payee);

    // Reserve 400 of the 500 balance → free = 100.
    let id = client.create_escrow(&1_u64, &payee, &400_i128, &SECONDS_PER_DAY);

    // A direct pay beyond the free balance is rejected (this was the bug).
    assert_eq!(
        client.try_pay(&2_u64, &payee, &150_i128),
        Err(Ok(Error::InsufficientFreeBalance))
    );

    // Exactly the free balance still clears…
    client.pay(&2_u64, &payee, &100_i128);
    assert_eq!(token.balance(&payee), 100);

    // …and the escrow can still be honored afterwards.
    client.release_escrow(&id);
    assert_eq!(token.balance(&payee), 500);
    assert_eq!(client.locked(), 0);
    assert_eq!(client.balance(), 0);
}

// --- auth: the wrong signer can never move funds or mutate policy ---------------

/// Only the registered agent can trigger `pay` — a call signed by anyone else
/// (here: the admin) is rejected by `require_auth` before any effect.
#[test]
fn pay_requires_agent_auth() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let agent = Address::generate(&env);
    let payee = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_addr);
    let token = TokenClient::new(&env, &token_addr);

    let id = env.register(
        Treasury,
        (admin.clone(), agent, token_addr, 1000_i128, 100_i128),
    );
    let client = TreasuryClient::new(&env, &id);

    env.mock_all_auths();
    token_admin.mint(&id, &500_i128);
    client.add_payee(&payee);

    // Sign as the ADMIN — `pay` requires the agent's auth, so the host rejects it.
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "pay",
            args: (1_u64, payee.clone(), 10_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    assert!(client.try_pay(&1_u64, &payee, &10_i128).is_err());
    assert_eq!(token.balance(&payee), 0);
    assert_eq!(client.day_spent(), 0);
}

/// Admin-gated mutations reject unauthenticated calls.
#[test]
fn add_payee_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    // Leave mock mode: with no auths provided, `require_auth` must trap.
    env.set_auths(&[]);
    assert!(client.try_add_payee(&payee).is_err());
    assert!(!client.is_payee(&payee));
}

/// Releasing an escrow is the admin's call — nobody else can trigger the payout.
#[test]
fn release_escrow_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);
    let id = client.create_escrow(&1_u64, &payee, &60_i128, &SECONDS_PER_DAY);

    env.set_auths(&[]);
    assert!(client.try_release_escrow(&id).is_err());
    assert_eq!(client.locked(), 60);
    assert_eq!(token.balance(&payee), 0);
    assert!(client.get_escrow(&id).is_some());
}

// --- escrow lifecycle edges ------------------------------------------------------

/// Unknown escrow ids surface `EscrowNotFound` from both entry points.
#[test]
fn escrow_unknown_id_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, _token) = setup(&env, 1000_i128, 100_i128);

    assert_eq!(
        client.try_release_escrow(&999_u64),
        Err(Ok(Error::EscrowNotFound))
    );
    assert_eq!(
        client.try_refund_escrow(&999_u64),
        Err(Ok(Error::EscrowNotFound))
    );
}

/// The daily limit gates `release_escrow` at the real moment of outflow (path #4).
#[test]
fn release_escrow_exceeds_daily_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 100_i128, 100_i128);
    client.add_payee(&payee);

    client.pay(&1_u64, &payee, &60_i128);
    let id = client.create_escrow(&2_u64, &payee, &50_i128, &SECONDS_PER_DAY);
    assert_eq!(
        client.try_release_escrow(&id),
        Err(Ok(Error::ExceedsDailyLimit))
    );

    // A fresh UTC day brings a fresh allowance — the release now clears.
    env.ledger().with_mut(|li| li.timestamp = SECONDS_PER_DAY);
    client.release_escrow(&id);
    assert_eq!(client.day_spent(), 50);
    assert_eq!(token.balance(&payee), 110);
}

/// A released escrow is gone — a second release cannot double-pay.
#[test]
fn escrow_double_release_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&1_u64, &payee, &60_i128, &SECONDS_PER_DAY);
    client.release_escrow(&id);
    assert_eq!(
        client.try_release_escrow(&id),
        Err(Ok(Error::EscrowNotFound))
    );
    assert_eq!(token.balance(&payee), 60);
    assert_eq!(client.locked(), 0);
}

/// A refunded escrow cannot be released afterwards.
#[test]
fn escrow_release_after_refund_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 1000_i128, 100_i128);
    client.add_payee(&payee);

    let id = client.create_escrow(&1_u64, &payee, &80_i128, &SECONDS_PER_DAY);
    env.ledger().with_mut(|li| li.timestamp = SECONDS_PER_DAY);
    client.refund_escrow(&id);

    assert_eq!(
        client.try_release_escrow(&id),
        Err(Ok(Error::EscrowNotFound))
    );
    assert_eq!(client.balance(), 500);
    assert_eq!(token.balance(&payee), 0);
}

/// The reputation gate is inclusive: a score exactly at the threshold clears,
/// one point below is rejected (`score >= min`).
#[test]
fn reputation_exact_threshold_allowed() {
    let env = Env::default();
    env.mock_all_auths();
    let (_payee, client, token) = setup(&env, 1000_i128, 100_i128);

    let rep_id = env.register(MockReputation, ());
    let rep = MockReputationClient::new(&env, &rep_id);
    client.set_reputation_policy(&rep_id, &50_i128);

    let exact = Address::generate(&env);
    rep.set_score(&exact, &50_i128);
    client.pay(&1_u64, &exact, &10_i128);
    assert_eq!(token.balance(&exact), 10);

    let below = Address::generate(&env);
    rep.set_score(&below, &49_i128);
    assert_eq!(
        client.try_pay(&2_u64, &below, &10_i128),
        Err(Ok(Error::BelowReputationThreshold))
    );
}

/// Direct pays and escrow releases fill the same daily allowance.
#[test]
fn pay_and_release_share_daily_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let (payee, client, token) = setup(&env, 100_i128, 100_i128);
    client.add_payee(&payee);

    client.pay(&1_u64, &payee, &60_i128);
    let id = client.create_escrow(&2_u64, &payee, &40_i128, &SECONDS_PER_DAY);
    client.release_escrow(&id); // 60 + 40 == 100 — exactly at the limit
    assert_eq!(client.day_spent(), 100);
    assert_eq!(token.balance(&payee), 100);

    assert_eq!(
        client.try_pay(&3_u64, &payee, &1_i128),
        Err(Ok(Error::ExceedsDailyLimit))
    );
}
