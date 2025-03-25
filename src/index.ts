import PromptSync from "prompt-sync";
import { logger } from "./utils";
import { createPoolInstruction, depositInstruction, swapInstruction, withdrawInstruction } from "./Swap/event";

const prompt = PromptSync();

async function start() {
    let running = true;
    while (running) {
        console.log("1. Create Pool");
        console.log("2. Deposit");
        console.log("3. Swap");
        console.log("4. Withdraw");
        console.log("Type 'exit or q' to quit.");

        const answer = prompt("Choose an option or 'exit': "); // Use prompt-sync for user input

        switch (answer) {
            case "1":
                await createPool();
                break;
            case "2":
                await deposit();
                break;
            case "3":
                await swap();
                break;
            case "4":
                await withdraw();
                break;
            case "q":
                running = false;
                break;
            case "exit":
                running = false;
                break;
            default:
                logger.info("Invalid option, please choose again.");
        }
    }
    logger.info("Exiting...");
    process.exit(0);
}

const createPool = async () => {
    await createPoolInstruction();
}
const deposit = async () => {
    await depositInstruction();
}
const swap = async () => {
    await swapInstruction();
}
const withdraw = async () => {
    await withdrawInstruction();
}

start().catch((err) => {
    console.error("Error:", err);
});