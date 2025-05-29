import { PumpAmmSdk } from "@pump-fun/pump-swap-sdk";
import { connection, walletKeypair } from "../config/constants";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";

const pumpAmmSDK = new PumpAmmSdk(connection);

export async function createPool(
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    initialPrice: number,
    swapFeeRate: number = 0.003, // 0.3% default fee
) {
    try {
        // Convert price to appropriate format (assuming price is in tokenB per tokenA)
        const priceNumerator = new BN(Math.floor(initialPrice * 1e6)); // Using 6 decimals for price
        const priceDenominator = new BN(1e6);

        // Create pool transaction
        const { transaction, poolAddress } = await pumpAmmSDK.createPool({
            tokenAMint,
            tokenBMint,
            priceNumerator,
            priceDenominator,
            swapFeeRate: Math.floor(swapFeeRate * 1e6), // Convert to basis points
            owner: walletKeypair.publicKey,
        });

        // Sign and send transaction
        transaction.sign(walletKeypair);
        const signature = await connection.sendTransaction(transaction);
        
        // Wait for confirmation
        await connection.confirmTransaction(signature);

        console.log("Pool created successfully!");
        console.log("Pool address:", poolAddress.toBase58());
        console.log("Transaction signature:", signature);

        return {
            poolAddress,
            signature,
        };
    } catch (error) {
        console.error("Error creating pool:", error);
        throw error;
    }
}


