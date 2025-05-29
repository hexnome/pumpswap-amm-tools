import { ComputeBudgetProgram, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import PumpSwapSDK from "./PumpSwapSDK";
import { PROTOCOL_FEE_RECIPIENT_MAINNET, isMainnet } from "./constants";
import { connection } from "../../config";
import { BN } from "bn.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as spl from "@solana/spl-token";
import { getTokenProgramId } from "./utils";
import { PumpAmmSdk, Direction } from "@pump-fun/pump-swap-sdk";
import { createAndFundWSOLAccount, exceuteJitoTx } from "../utils";

const pumpAmmSDK = new PumpAmmSdk(connection);

export const pumpSwap = async (wallet: Keypair, tokenMint: PublicKey, amount: number, sells: number[]) => {
    try {
        console.log("PumpSwap Start");
        // await createAndFundWSOLAccount(wallet, amount)
        console.log("sells-->", sells[0])
        const pumpSwap = new PumpSwapSDK(isMainnet ? "mainnet" : "devnet", "confirmed");
        const pool = await pumpSwap.getPumpSwapPool(tokenMint);
        if (!pool) {
            console.log("Pool not found");
            throw new Error("Pool not found");
        }
        console.log("Pool", pool);
        // Get the token program ID for the non-WSOL token
        const tokenProgramId = await getTokenProgramId(tokenMint);
        console.log("TokenProgramId", tokenProgramId.toBase58());
        // Get the token ATA with the correct program ID
        const TokenATA = await spl.getAssociatedTokenAddress(
            tokenMint,
            wallet.publicKey,
            false,
            tokenProgramId,
            spl.ASSOCIATED_TOKEN_PROGRAM_ID
        );
        console.log("TokenATA", TokenATA.toBase58());
        const QuoteATA = await spl.getAssociatedTokenAddress(
            NATIVE_MINT,
            wallet.publicKey,
            false,
            tokenProgramId,
            spl.ASSOCIATED_TOKEN_PROGRAM_ID
        );
        // Create ATA instructions with correct program IDs
        const createTokenBaseAta =
            spl.createAssociatedTokenAccountIdempotentInstruction(
                wallet.publicKey,
                TokenATA,
                wallet.publicKey,
                tokenMint,
                tokenProgramId,
                spl.ASSOCIATED_TOKEN_PROGRAM_ID
            );
        const createTokenQuoteAta =
            spl.createAssociatedTokenAccountIdempotentInstruction(
                wallet.publicKey,
                QuoteATA,
                wallet.publicKey,
                NATIVE_MINT,
                tokenProgramId,
                spl.ASSOCIATED_TOKEN_PROGRAM_ID
            );

        const quote_amt = new BN(amount * LAMPORTS_PER_SOL);
        const base_amt = await pumpAmmSDK.swapAutocompleteBaseFromQuote(
            pool,
            quote_amt,
            2.0,
            "quoteToBase" as Direction,
        )
        console.log("base_amt", base_amt.toString());

        const versionedTransaction: VersionedTransaction[] = [];

        const buyIx = await pumpAmmSDK.swapBaseInstructions(
            pool,
            base_amt,
            2.0,
            "quoteToBase" as Direction,
            wallet.publicKey,
            PROTOCOL_FEE_RECIPIENT_MAINNET,
            TokenATA,
            QuoteATA,
        );

        console.log("buyIx", buyIx);
        const updateCpIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 });
        const updateCuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1000_000 });

        const buyIxs = [updateCuIx, updateCpIx, createTokenBaseAta, createTokenQuoteAta, buyIx[buyIx.length - 2]];

        const blockhash = await connection.getLatestBlockhash();

        const buyTx = new VersionedTransaction(
            new TransactionMessage({
                payerKey: wallet.publicKey,
                recentBlockhash: blockhash.blockhash,
                instructions: buyIxs,
            }).compileToV0Message(),
        );
        buyTx.sign([wallet]);
        versionedTransaction.push(buyTx);

        for (let index = 0; index < sells.length; index++) {
            console.log("sells[index]", sells[index]);
            const element = sells[index];
            const sellAmount = Math.floor(Number(base_amt) * element / 100);
            const sellIx = await pumpAmmSDK.swapBaseInstructions(
                pool,
                new BN(sellAmount),
                2.0,
                "baseToQuote" as Direction,
                wallet.publicKey,
                PROTOCOL_FEE_RECIPIENT_MAINNET,
                TokenATA,
                QuoteATA,
            );

            console.log("sellIx", sellIx);
            const sellIxs: TransactionInstruction[] = [updateCpIx, updateCuIx, sellIx[0]];

            const sellTx = new VersionedTransaction(
                new TransactionMessage({
                    payerKey: wallet.publicKey,
                    recentBlockhash: blockhash.blockhash,
                    instructions: sellIxs,
                }).compileToV0Message(),
            );

            sellTx.sign([wallet]);
            versionedTransaction.push(sellTx);
        }

        // versionedTransaction.map(async (tx, i) => console.log(i, " | ", tx.serialize().length, "bytes | \n", (await connection.simulateTransaction(tx, { sigVerify: true }))))

        return await exceuteJitoTx(
            versionedTransaction,
            wallet,
            blockhash,
            0.00001
        );
    } catch (error) {
        console.log("Error in pumpSwap", error);
        throw new Error("Error in pumpSwap");
    }
}