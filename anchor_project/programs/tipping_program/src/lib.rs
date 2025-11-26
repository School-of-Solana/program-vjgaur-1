use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("3S6BeKoGiRbrkMKuRfGYRp2D5eEe1KYENhEfdUioKUGi");

#[program]
pub mod tipping_program {
    use super::*;

    /// Initialize a new tip account for a recipient
    pub fn initialize_tip_account(ctx: Context<InitializeTipAccount>) -> Result<()> {
        let tip_account = &mut ctx.accounts.tip_account;
        tip_account.recipient = ctx.accounts.recipient.key();
        tip_account.total_tips = 0;
        tip_account.bump = ctx.bumps.tip_account;

        msg!(
            "Tip account initialized for: {}",
            ctx.accounts.recipient.key()
        );
        Ok(())
    }

    /// Send a tip to a recipient
    pub fn send_tip(ctx: Context<SendTip>, amount: u64) -> Result<()> {
        require!(amount > 0, TippingError::InvalidAmount);

        // Transfer SOL from tipper to tip account
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.tipper.to_account_info(),
                to: ctx.accounts.tip_account.to_account_info(),
            },
        );
        transfer(cpi_context, amount)?;

        // Update tip account
        let tip_account = &mut ctx.accounts.tip_account;
        tip_account.total_tips = tip_account
            .total_tips
            .checked_add(amount)
            .ok_or(TippingError::Overflow)?;

        msg!("Tip sent: {} lamports to {}", amount, tip_account.recipient);
        Ok(())
    }

    /// Withdraw accumulated tips (only recipient can withdraw)
    pub fn withdraw_tips(ctx: Context<WithdrawTips>, amount: u64) -> Result<()> {
        let tip_account = &ctx.accounts.tip_account;

        require!(amount > 0, TippingError::InvalidAmount);
        require!(
            **tip_account.to_account_info().lamports.borrow() >= amount,
            TippingError::InsufficientFunds
        );

        // Transfer from tip account to recipient
        let recipient_key = tip_account.recipient;
        let seeds = &[b"tip_account", recipient_key.as_ref(), &[tip_account.bump]];
        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: tip_account.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
            signer,
        );
        transfer(cpi_context, amount)?;

        msg!("Withdrawn: {} lamports by {}", amount, recipient_key);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeTipAccount<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + TipAccount::INIT_SPACE,
        seeds = [b"tip_account", recipient.key().as_ref()],
        bump
    )]
    pub tip_account: Account<'info, TipAccount>,

    /// CHECK: This is the recipient who will receive tips
    pub recipient: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendTip<'info> {
    #[account(
        mut,
        seeds = [b"tip_account", tip_account.recipient.as_ref()],
        bump = tip_account.bump,
    )]
    pub tip_account: Account<'info, TipAccount>,

    #[account(mut)]
    pub tipper: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawTips<'info> {
    #[account(
        mut,
        seeds = [b"tip_account", recipient.key().as_ref()],
        bump = tip_account.bump,
        has_one = recipient @ TippingError::UnauthorizedWithdrawal
    )]
    pub tip_account: Account<'info, TipAccount>,

    #[account(mut)]
    pub recipient: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct TipAccount {
    pub recipient: Pubkey, // 32 bytes
    pub total_tips: u64,   // 8 bytes
    pub bump: u8,          // 1 byte
}

#[error_code]
pub enum TippingError {
    #[msg("Amount must be greater than 0")]
    InvalidAmount,

    #[msg("Only the recipient can withdraw tips")]
    UnauthorizedWithdrawal,

    #[msg("Insufficient funds in tip account")]
    InsufficientFunds,

    #[msg("Arithmetic overflow")]
    Overflow,
}
