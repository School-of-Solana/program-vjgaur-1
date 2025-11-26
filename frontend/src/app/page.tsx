"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import idl from "../idl/tipping_program.json";

// Replace with your deployed program ID
const PROGRAM_ID = new PublicKey("TipPingProgram11111111111111111111111111111");

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [status, setStatus] = useState("");
  const [tipAccountBalance, setTipAccountBalance] = useState<number | null>(null);

  const getProvider = () => {
    if (!wallet.publicKey) return null;
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    return provider;
  };

  const getProgram = () => {
    const provider = getProvider();
    if (!provider) return null;
    return new Program(idl as any, provider);
  };

  const getTipAccountPDA = async (recipient: PublicKey) => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("tip_account"), recipient.toBuffer()],
      PROGRAM_ID
    );
    return pda;
  };

  const initializeTipAccount = async () => {
    try {
      if (!recipientAddress) {
        setStatus("Please enter a recipient address");
        return;
      }

      const program = getProgram();
      if (!program || !wallet.publicKey) {
        setStatus("Please connect your wallet");
        return;
      }

      setStatus("Initializing tip account...");
      const recipient = new PublicKey(recipientAddress);
      const tipAccountPda = await getTipAccountPDA(recipient);

      const tx = await program.methods
        .initializeTipAccount()
        .accounts({
          tipAccount: tipAccountPda,
          recipient: recipient,
          payer: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      setStatus(`✅ Tip account initialized! Tx: ${tx.slice(0, 8)}...`);
    } catch (error: any) {
      console.error(error);
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const sendTip = async () => {
    try {
      if (!recipientAddress || !tipAmount) {
        setStatus("Please enter recipient address and tip amount");
        return;
      }

      const program = getProgram();
      if (!program || !wallet.publicKey) {
        setStatus("Please connect your wallet");
        return;
      }

      setStatus("Sending tip...");
      const recipient = new PublicKey(recipientAddress);
      const tipAccountPda = await getTipAccountPDA(recipient);
      const amountLamports = parseFloat(tipAmount) * LAMPORTS_PER_SOL;

      const tx = await program.methods
        .sendTip(new BN(amountLamports))
        .accounts({
          tipAccount: tipAccountPda,
          tipper: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      setStatus(`✅ Tip sent! ${tipAmount} SOL sent. Tx: ${tx.slice(0, 8)}...`);
      setTipAmount("");
      await checkBalance();
    } catch (error: any) {
      console.error(error);
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const withdrawTips = async () => {
    try {
      if (!withdrawAmount) {
        setStatus("Please enter withdraw amount");
        return;
      }

      const program = getProgram();
      if (!program || !wallet.publicKey) {
        setStatus("Please connect your wallet");
        return;
      }

      setStatus("Withdrawing tips...");
      const tipAccountPda = await getTipAccountPDA(wallet.publicKey);
      const amountLamports = parseFloat(withdrawAmount) * LAMPORTS_PER_SOL;

      const tx = await program.methods
        .withdrawTips(new BN(amountLamports))
        .accounts({
          tipAccount: tipAccountPda,
          recipient: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      setStatus(`✅ Withdrawn! ${withdrawAmount} SOL withdrawn. Tx: ${tx.slice(0, 8)}...`);
      setWithdrawAmount("");
      await checkBalance();
    } catch (error: any) {
      console.error(error);
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const checkBalance = async () => {
    try {
      if (!recipientAddress && !wallet.publicKey) {
        setStatus("Please enter a recipient address or connect wallet");
        return;
      }

      const program = getProgram();
      if (!program) {
        setStatus("Please connect your wallet");
        return;
      }

      const recipient = recipientAddress 
        ? new PublicKey(recipientAddress) 
        : wallet.publicKey!;
      const tipAccountPda = await getTipAccountPDA(recipient);

      try {
        const balance = await connection.getBalance(tipAccountPda);
        setTipAccountBalance(balance / LAMPORTS_PER_SOL);
        
        const account = await program.account.tipAccount.fetch(tipAccountPda);
        setStatus(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL | Total tips: ${(account.totalTips.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      } catch (error) {
        setStatus("Tip account not initialized yet");
        setTipAccountBalance(null);
      }
    } catch (error: any) {
      console.error(error);
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-primary">💸 Solana Tipping dApp</h1>
          <WalletMultiButton />
        </div>

        {!wallet.connected ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-xl mb-4">Connect your wallet to get started!</p>
            <p className="text-gray-400">Make sure you're on Devnet network</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Display */}
            {status && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-sm">{status}</p>
              </div>
            )}

            {/* Initialize Tip Account */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-4 text-primary">1. Initialize Tip Account</h2>
              <p className="text-gray-400 mb-4 text-sm">
                Create a tip account for a recipient (do this once per recipient)
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Recipient's Solana Address"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-primary focus:outline-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={initializeTipAccount}
                    className="flex-1 bg-primary text-black font-semibold py-3 px-6 rounded hover:bg-opacity-80 transition"
                  >
                    Initialize Account
                  </button>
                  <button
                    onClick={checkBalance}
                    className="bg-gray-700 text-white font-semibold py-3 px-6 rounded hover:bg-gray-600 transition"
                  >
                    Check Balance
                  </button>
                </div>
              </div>
            </div>

            {/* Send Tip */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-4 text-primary">2. Send Tip</h2>
              <p className="text-gray-400 mb-4 text-sm">
                Send SOL tip to the recipient address above
              </p>
              <div className="space-y-3">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount in SOL (e.g., 0.1)"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-primary focus:outline-none"
                />
                <button
                  onClick={sendTip}
                  className="w-full bg-secondary text-white font-semibold py-3 px-6 rounded hover:bg-opacity-80 transition"
                >
                  Send Tip 💰
                </button>
              </div>
            </div>

            {/* Withdraw Tips */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-semibold mb-4 text-primary">3. Withdraw Tips</h2>
              <p className="text-gray-400 mb-4 text-sm">
                Withdraw tips from YOUR tip account (your wallet must be the recipient)
              </p>
              <div className="space-y-3">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount in SOL (e.g., 0.1)"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:border-primary focus:outline-none"
                />
                <button
                  onClick={withdrawTips}
                  className="w-full bg-green-600 text-white font-semibold py-3 px-6 rounded hover:bg-green-500 transition"
                >
                  Withdraw Tips 💸
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setRecipientAddress(wallet.publicKey?.toString() || "")}
                  className="bg-gray-700 text-white py-2 px-4 rounded hover:bg-gray-600 transition text-sm"
                >
                  Use My Address
                </button>
                <button
                  onClick={() => {
                    setRecipientAddress("");
                    setTipAmount("");
                    setWithdrawAmount("");
                    setStatus("");
                    setTipAccountBalance(null);
                  }}
                  className="bg-gray-700 text-white py-2 px-4 rounded hover:bg-gray-600 transition text-sm"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Built with ❤️ on Solana | School of Solana Assignment</p>
          <p className="mt-2">Network: Devnet</p>
        </div>
      </div>
    </main>
  );
}