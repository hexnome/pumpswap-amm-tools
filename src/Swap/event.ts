import { PublicKey } from "@solana/web3.js";
import { connection, walletKeypair } from "../config/constants";

import { PumpAmmSdk } from "@pump-fun/pump-swap-sdk";
const pumpAmmSdk = new PumpAmmSdk(connection);

export const createPoolInstruction = async () => {
    const wallet = walletKeypair
    const createPoolInstructions = await pumpAmmSdk.createPoolInstructions(
        index,
        wallet.publicKey,
        baseMint,
        quoteMint,
        baseIn,
        quoteIn,
    );
    // Get initial pool price for UI
    const initialPoolPrice = pumpAmmSdk.createAutocompleteInitialPoolPrice(
        initialBase,
        initialQuote,
    );

    // Build and send transaction
    const transaction = transactionFromInstructions(createPoolInstructions);
    const signature = await sendAndConfirmTransaction(transaction);
}

export const depositInstruction = async () => {
    // When base input changes
    const { quote, lpToken } =
        await pumpAmmSdk.depositAutocompleteQuoteAndLpTokenFromBase(
            pool,
            base,
            slippage,
        );

    // When quote input changes
    const { base, lpToken } =
        await pumpAmmSdk.depositAutocompleteBaseAndLpTokenFromQuote(
            pool,
            quote,
            slippage,
        );

    // Execute deposit
    const depositInstructions = await pumpAmmSdk.depositInstructions(
        pool,
        lpToken,
        slippage,
        user,
    );
    const transaction = transactionFromInstructions(depositInstructions);
    const signature = await sendAndConfirmTransaction(transaction);
}
export const swapInstruction = async () => {
    // Quote to Base swap (⬇️)
    const baseAmount = await pumpAmmSdk.swapAutocompleteBaseFromQuote(
        pool,
        quoteAmount,
        slippage,
        Direction.QuoteToBase,
    );

    // Base to Quote swap (⬆️)
    const quoteAmount = await pumpAmmSdk.swapAutocompleteQuoteFromBase(
        pool,
        baseAmount,
        slippage,
        Direction.BaseToQuote,
    );

    // Execute swap
    const swapInstructions = await pumpAmmSdk.swapInstructions(
        pool,
        baseAmount,
        slippage,
        Direction.QuoteToBase,
        user,
    );
    const transaction = transactionFromInstructions(swapInstructions);
    const signature = await sendAndConfirmTransaction(transaction);
}
export const withdrawInstruction = async () => {
    // Get expected output amounts
    const { base, quote } = pumpAmmSdk.withdrawAutocompleteBaseAndQuoteFromLpToken(
        pool,
        lpToken,
        slippage,
    );

    // Execute withdrawal
    const withdrawInstructions = await pumpAmmSdk.withdrawInstructions(
        pool,
        lpToken,
        slippage,
        user,
    );
    const transaction = transactionFromInstructions(withdrawInstructions);
    const signature = await sendAndConfirmTransaction(transaction);
}  