# Tipping Program - Solana dApp

A simple decentralized tipping application built on Solana using the Anchor framework.

## Features

- **Initialize Tip Account**: Create a PDA-based tip account for any recipient
- **Send Tips**: Anyone can send SOL tips to a recipient's tip account
- **Withdraw Tips**: Only the recipient can withdraw accumulated tips

## Program Structure

### Instructions

1. **initialize_tip_account**: Creates a new tip account PDA for a recipient
   - PDA Seeds: `["tip_account", recipient_pubkey]`
2. **send_tip**: Sends SOL from tipper to tip account
   - Validates amount > 0
   - Updates total_tips counter
3. **withdraw_tips**: Allows recipient to withdraw accumulated tips
   - Only recipient can withdraw (enforced by PDA constraint)
   - Validates sufficient balance

### Account Structure

```rust
pub struct TipAccount {
    pub recipient: Pubkey,  // 32 bytes
    pub total_tips: u64,    // 8 bytes
    pub bump: u8,           // 1 byte
}
```

## Testing

Tests cover both happy and unhappy paths:

**Happy Paths:**

- ✅ Initialize tip account
- ✅ Send single tip
- ✅ Send multiple tips
- ✅ Withdraw tips

**Unhappy Paths:**

- ❌ Cannot initialize same account twice
- ❌ Cannot send 0 amount tip
- ❌ Cannot tip non-existent account
- ❌ Cannot withdraw 0 amount
- ❌ Non-recipient cannot withdraw
- ❌ Cannot withdraw more than balance

Run tests:

```bash
anchor test
```

## Building & Deployment

```bash
# Build
anchor build

# Deploy to Devnet
anchor deploy --provider.cluster devnet

# Get program ID
solana address -k target/deploy/tipping_program-keypair.json
```

## Program ID

Program ID will be generated after deployment. Update in:

- `programs/tipping_program/src/lib.rs` (declare_id!)
- `Anchor.toml`
