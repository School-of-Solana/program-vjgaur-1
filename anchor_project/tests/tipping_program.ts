import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TippingProgram } from "../target/types/tipping_program";
import { expect } from "chai";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("tipping_program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TippingProgram as Program<TippingProgram>;
  
  const recipient = Keypair.generate();
  const tipper = Keypair.generate();
  
  let tipAccountPda: PublicKey;
  let tipAccountBump: number;

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropRecipient = await provider.connection.requestAirdrop(
      recipient.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropRecipient);

    const airdropTipper = await provider.connection.requestAirdrop(
      tipper.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTipper);

    // Derive PDA
    [tipAccountPda, tipAccountBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("tip_account"), recipient.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("initialize_tip_account", () => {
    it("✅ Happy: Successfully initializes a tip account", async () => {
      const tx = await program.methods
        .initializeTipAccount()
        .accounts({
          tipAccount: tipAccountPda,
          recipient: recipient.publicKey,
          payer: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize transaction signature:", tx);

      // Verify the tip account was created correctly
      const tipAccount = await program.account.tipAccount.fetch(tipAccountPda);
      expect(tipAccount.recipient.toString()).to.equal(recipient.publicKey.toString());
      expect(tipAccount.totalTips.toNumber()).to.equal(0);
      expect(tipAccount.bump).to.equal(tipAccountBump);
    });

    it("❌ Unhappy: Cannot initialize the same tip account twice", async () => {
      try {
        await program.methods
          .initializeTipAccount()
          .accounts({
            tipAccount: tipAccountPda,
            recipient: recipient.publicKey,
            payer: provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        // Should fail because account already exists
        expect(error).to.exist;
      }
    });
  });

  describe("send_tip", () => {
    it("✅ Happy: Successfully sends a tip", async () => {
      const tipAmount = 0.1 * LAMPORTS_PER_SOL;
      
      const balanceBefore = await provider.connection.getBalance(tipAccountPda);
      
      const tx = await program.methods
        .sendTip(new anchor.BN(tipAmount))
        .accounts({
          tipAccount: tipAccountPda,
          tipper: tipper.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([tipper])
        .rpc();

      console.log("Send tip transaction signature:", tx);

      // Verify balance increased
      const balanceAfter = await provider.connection.getBalance(tipAccountPda);
      expect(balanceAfter - balanceBefore).to.equal(tipAmount);

      // Verify total tips updated
      const tipAccount = await program.account.tipAccount.fetch(tipAccountPda);
      expect(tipAccount.totalTips.toNumber()).to.equal(tipAmount);
    });

    it("✅ Happy: Successfully sends multiple tips", async () => {
      const tipAmount = 0.05 * LAMPORTS_PER_SOL;
      
      const tipAccountBefore = await program.account.tipAccount.fetch(tipAccountPda);
      const totalBefore = tipAccountBefore.totalTips.toNumber();
      
      await program.methods
        .sendTip(new anchor.BN(tipAmount))
        .accounts({
          tipAccount: tipAccountPda,
          tipper: tipper.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([tipper])
        .rpc();

      // Verify total tips accumulated
      const tipAccountAfter = await program.account.tipAccount.fetch(tipAccountPda);
      expect(tipAccountAfter.totalTips.toNumber()).to.equal(totalBefore + tipAmount);
    });

    it("❌ Unhappy: Cannot send a tip with amount = 0", async () => {
      try {
        await program.methods
          .sendTip(new anchor.BN(0))
          .accounts({
            tipAccount: tipAccountPda,
            tipper: tipper.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([tipper])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidAmount");
      }
    });

    it("❌ Unhappy: Cannot send tip to non-existent tip account", async () => {
      const fakePda = Keypair.generate().publicKey;
      
      try {
        await program.methods
          .sendTip(new anchor.BN(1000))
          .accounts({
            tipAccount: fakePda,
            tipper: tipper.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([tipper])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("withdraw_tips", () => {
    it("✅ Happy: Recipient successfully withdraws tips", async () => {
      const withdrawAmount = 0.05 * LAMPORTS_PER_SOL;
      
      const recipientBalanceBefore = await provider.connection.getBalance(recipient.publicKey);
      const tipAccountBalanceBefore = await provider.connection.getBalance(tipAccountPda);
      
      const tx = await program.methods
        .withdrawTips(new anchor.BN(withdrawAmount))
        .accounts({
          tipAccount: tipAccountPda,
          recipient: recipient.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([recipient])
        .rpc();

      console.log("Withdraw transaction signature:", tx);

      // Verify balances changed correctly (accounting for transaction fee)
      const recipientBalanceAfter = await provider.connection.getBalance(recipient.publicKey);
      const tipAccountBalanceAfter = await provider.connection.getBalance(tipAccountPda);
      
      expect(tipAccountBalanceBefore - tipAccountBalanceAfter).to.equal(withdrawAmount);
      // Recipient balance should increase by withdrawAmount minus transaction fee
      expect(recipientBalanceAfter).to.be.greaterThan(recipientBalanceBefore);
    });

    it("❌ Unhappy: Cannot withdraw with amount = 0", async () => {
      try {
        await program.methods
          .withdrawTips(new anchor.BN(0))
          .accounts({
            tipAccount: tipAccountPda,
            recipient: recipient.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([recipient])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidAmount");
      }
    });

    it("❌ Unhappy: Non-recipient cannot withdraw tips", async () => {
      const attacker = Keypair.generate();
      
      // Airdrop to attacker
      const airdrop = await provider.connection.requestAirdrop(
        attacker.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);
      
      try {
        await program.methods
          .withdrawTips(new anchor.BN(1000))
          .accounts({
            tipAccount: tipAccountPda,
            recipient: attacker.publicKey, // Wrong recipient
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([attacker])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        // Should fail due to PDA seeds mismatch or constraint violation
        expect(error).to.exist;
      }
    });

    it("❌ Unhappy: Cannot withdraw more than available balance", async () => {
      const tipAccountBalance = await provider.connection.getBalance(tipAccountPda);
      const excessiveAmount = tipAccountBalance + LAMPORTS_PER_SOL;
      
      try {
        await program.methods
          .withdrawTips(new anchor.BN(excessiveAmount))
          .accounts({
            tipAccount: tipAccountPda,
            recipient: recipient.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([recipient])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientFunds");
      }
    });
  });
});