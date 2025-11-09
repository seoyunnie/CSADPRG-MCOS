/*
 * Last Names: Panaligan (Author), Casihan, Cotoco, Mascardo
 * Language: JavaScript
 * Paradigm(s): Procedural, Object-Oriented, Functional
 */

import process from "node:process";
import * as readline from "node:readline/promises";

/**
 * Prints an array's contents as CLI prompt choices.
 *
 * The array's elements are stringified and printed along with their index incremented by one (`i + 1`), serving as the
 * choice's identifier.
 *
 * @template {{ toString(): string }} T The type of the choices to print. It must be convertible to a string type.
 * @param {readonly T[]} choices The choices to print.
 */
function printChoices(choices) {
  for (const [i, val] of choices.entries()) {
    console.log(`[${i + 1}] ${val.toString()}`);
  }
}

/**
 * Prompts a CLI user to input a response.
 *
 * A message is printed before awaiting the user's response, which is inputted on the same line in the console.
 *
 * @param {string} msg The prompt message to print.
 * @returns {Promise<string>} The user's direct response.
 */
async function prompt(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const input = await rl.question(msg);

  rl.close();

  return input;
}

/** The titles or labels of the exchangeable currencies. */
const CURRENCY_TITLES = Object.freeze(
  /** @type {const} */ ([
    "Philippine Peso (PHP)",
    "United States Dollar (USD)",
    "Japanese Yen (JPY)",
    "British Pound Sterling (GBP)",
    "Euro (EUR)",
    "Chinese Yuan Renminni (CNY)",
  ]),
);
/** The {@link https://en.wikipedia.org/wiki/ISO_4217 | ISO 4217} codes of the exchangeable currencies. */
const CURRENCY_CODES = Object.freeze(CURRENCY_TITLES.map((c) => c.slice(-4, -1)));

/** The titles of the available transactional procedures. */
const TRANSACTION_TITLES = Object.freeze(
  /** @type {const} */ ([
    "Register Account Name",
    "Deposit Amount",
    "Withdraw Amount",
    "Currency Exchange",
    "Record Exchange Rates",
    "Show Interest Amount",
  ]),
);

/** A simple user bank account. */
class Account {
  /**
   * The name of the owner of the account.
   * @readonly
   * @type {string}
   */
  name;
  /**
   * The current balance of the account.
   * @type {number}
   */
  balance = 0;
  /**
   * The currency that the account's balance is based on.
   * @readonly
   */
  currency = "PHP";

  /**
   * Creates and returns a new `Account` object.
   * @param {string} name The name of the owner of the account.
   */
  constructor(name) {
    this.name = name;
  }
}

/**
 * Converts an amount from one currency to another.
 *
 * @param {number} amount The amount to convert.
 * @param {string} src The currency to convert from.
 * @param {string} dest The currency to convert to.
 * @param {ReadonlyMap<string, number>} rates The current currency exchange rates.
 * @returns {number} The equivalent amount in the new currency.
 */
function convertCurrency(amount, src, dest, rates) {
  // @ts-ignore: `src` is guaranteed to be a key in `rates`.
  const srcPHPAmount = src === "PHP" ? amount : amount * rates.get(src);

  // @ts-ignore: `dest` is guaranteed to be a key in `rates`.
  return dest === "PHP" ? srcPHPAmount : srcPHPAmount * rates.get(dest);
}

/**
 * Deposits balance to a user's account.
 *
 * The user is prompted to input the currency and amount of balance to deposit.
 *
 * @param {Account} account The account to deposit to.
 * @param {ReadonlyMap<string, number>} rates The current currency exchange rates.
 */
async function depositBalance(account, rates) {
  console.log(`Current Balance: ${account.balance}`);

  const currency = (await prompt("Currency: ")).toUpperCase();

  if (!CURRENCY_CODES.some((c) => c === currency)) {
    console.log("No currency with this code exists!");

    return;
  }

  console.log();

  try {
    const amount = Number.parseFloat(await prompt("Deposit Amount: "));
    account.balance += currency === "PHP" ? amount : convertCurrency(amount, currency, "PHP", rates);

    console.log(`Updated Balance: ${account.balance}`);
  } catch {
    console.log("Deposit amount must be a floating point number!");
  }
}

/**
 * Withdraws balance from a user's account.
 *
 * The user is prompted to input the currency and amount of balance to withdraw. If the amount is greater than the
 * account's current balance, the transaction is cancelled.
 *
 * @param {Account} account The account to withdraw from.
 * @param {ReadonlyMap<string, number>} rates The current currency exchange rates.
 */
async function withdrawBalance(account, rates) {
  console.log(`Current Balance: ${account.balance}`);

  const currency = (await prompt("Currency: ")).toUpperCase();

  if (!CURRENCY_CODES.some((c) => c === currency)) {
    console.log("No currency with this code exists!");

    return;
  }

  console.log();

  try {
    let amount = Number.parseFloat(await prompt("Withdraw Amount: "));
    amount = currency === "PHP" ? amount : convertCurrency(amount, currency, "PHP", rates);

    if (account.balance - amount < 0) {
      console.log("Withdraw amount must be less than the current balance!");

      return;
    }

    account.balance -= amount;

    console.log(`Updated Balance: ${account.balance}`);
  } catch {
    console.log("Withdraw amount must be a floating point number!");
  }
}

/**
 * Calculates and prints how much one currency is worth in another.
 *
 * The user is prompted to input the amount and what currencies to exchange.
 *
 * @param {ReadonlyMap<string, number>} rates The current currency exchange rates.
 */
async function exchangeCurrencies(rates) {
  console.log("Source Currency Options:");
  printChoices(CURRENCY_TITLES);

  console.log();

  /** @type {number} */
  let srcIdx;

  try {
    srcIdx = Number.parseInt(await prompt("Source Currency: ")) - 1;

    if (srcIdx < 0) {
      // Trigger the error handling (`catch` block).
      throw new TypeError();
    }
  } catch {
    console.log("ID must be a positive whole number (integer)!");

    return;
  }

  if (srcIdx >= CURRENCY_TITLES.length) {
    console.log("No currency with this ID exists!");

    return;
  }

  /** @type {number} */
  let srcAmount;

  try {
    srcAmount = Number.parseFloat(await prompt("Source Amount: "));
  } catch {
    console.log("Amount must be a floating point number!");

    return;
  }

  console.log();

  console.log("Exchanged Currency Options:");
  printChoices(CURRENCY_TITLES);

  console.log();

  /** @type {number} */
  let exchangeIdx;

  try {
    exchangeIdx = Number.parseInt(await prompt("Exchange Currency: ")) - 1;

    if (exchangeIdx < 0) {
      // Trigger the error handling (`catch` block).
      throw new TypeError();
    }
  } catch {
    console.log("ID must be a positive whole number (integer)!");

    return;
  }

  if (exchangeIdx >= CURRENCY_TITLES.length) {
    console.log("No currency with this ID exists!");

    return;
  }

  console.log(
    `Exchange Amount: ${convertCurrency(srcAmount, CURRENCY_CODES[srcIdx], CURRENCY_CODES[exchangeIdx], rates)}`,
  );
}

/**
 * Updates the exchange rate between a currency and Philippine Pesos.
 *
 * The user is prompted to input the currency and its value in PHP.
 *
 * @param {Map<string, number>} rates The current currency exchange rates.
 */
async function setExchangeRates(rates) {
  printChoices(CURRENCY_TITLES.slice(1));

  console.log();

  /** @type {number} */
  let idx;

  try {
    idx = Number.parseInt(await prompt("Select Foreign Currency: "));

    if (idx < 0) {
      // Trigger the error handling (`catch` block).
      throw new TypeError();
    }
  } catch {
    console.log("ID must be a positive whole number (integer)!");

    return;
  }

  if (idx >= CURRENCY_TITLES.length) {
    console.log("No currency with this ID exists!");

    return;
  }

  try {
    rates.set(CURRENCY_TITLES[idx], Number.parseFloat(await prompt("Exchange Rate: ")));
  } catch {
    console.log("Amount must be a floating point number!");
  }
}

/** The fixed annual interest rate percentage. */
const ANNUAL_INTEREST_RATE = 0.05;

/**
 * Calculates and prints the daily increase to an account's balance from interest.
 *
 * The user is prompted to input the number of days to calculate for.
 *
 * @param {Readonly<Account>} account The account to calculate the interest of.
 */
async function calculateInterest(account) {
  let { balance } = account;

  console.log(`Current Balance: ${balance}`);
  console.log(`Currency: ${account.currency}`);
  console.log(`Interest Rate: ${ANNUAL_INTEREST_RATE * 100}`);

  console.log();

  /** @type {number} */
  let dayCnt;

  try {
    dayCnt = Number.parseInt(await prompt("Total Number of Days: "));

    if (dayCnt < 0) {
      // Trigger the error handling (`catch` block).
      throw new TypeError();
    }
  } catch {
    console.log("Number must be a positive whole number (integer)!");

    return;
  }

  console.log();

  console.log("Day | Interest | Balance |");

  const dailyInterest = Math.round(balance * (ANNUAL_INTEREST_RATE / 365) * 100) / 100;

  for (let i = 1; i <= dayCnt; i++) {
    balance += dailyInterest;

    console.log(
      `${String(i).padEnd(3)} | ${String(dailyInterest).padEnd(8)} | ${String(balance.toFixed(2)).padEnd(7)} |`,
    );
  }
}

void (async function main() {
  /** @type {Account[]} */
  const accounts = [];
  /** @type {Map<string, number>} */
  const exchangeRates = new Map();

  for (const code of CURRENCY_CODES.values().drop(1)) {
    exchangeRates.set(code, 1.0);
  }

  mainMenu: while (true) {
    console.log("Select Transaction:");
    printChoices(TRANSACTION_TITLES);

    console.log();

    /** @type {number} */
    let chosenIdx;

    try {
      chosenIdx = Number.parseInt(await prompt("> "), 10);
    } catch {
      chosenIdx = 0;
    }

    console.log();

    if (chosenIdx > 0 && chosenIdx <= TRANSACTION_TITLES.length) {
      console.log(TRANSACTION_TITLES[chosenIdx - 1]);
    }

    switch (chosenIdx) {
      case 1: {
        const account = new Account(await prompt("Account Name: "));

        if (!accounts.some((a) => a.name === account.name)) {
          accounts.push(account);
        } else {
          console.log("An account with this name already exists!");
        }

        break;
      }
      case 2:
      case 3: {
        const accountName = await prompt("Account Name: ");
        const account = accounts.find(async (a) => a.name === accountName);

        if (account) {
          if (chosenIdx === 2) {
            await depositBalance(account, exchangeRates);
          } else {
            await withdrawBalance(account, exchangeRates);
          }
        } else {
          console.log("No account with this name exists!");
        }

        break;
      }
      case 4:
        currencyExchange: while (true) {
          await exchangeCurrencies(exchangeRates);

          console.log();

          repeatPrompt: while (true) {
            const isRepeating = (await prompt("Convert another currency? (Y/N): ")).toUpperCase();

            if (isRepeating.toUpperCase() === "Y") {
              console.log();

              break repeatPrompt;
            } else if (isRepeating.toUpperCase() === "N") {
              break currencyExchange;
            } else {
              console.log("Only accepting a [Y]es or [N]o answer!");

              console.log();
            }
          }
        }

        break;
      case 5:
        console.log();

        await setExchangeRates(exchangeRates);

        break;
      case 6:
        const accountName = await prompt("Account Name: ");
        const account = accounts.find(async (a) => a.name === accountName);

        if (account) {
          await calculateInterest(account);
        } else {
          console.log("No account with this name exists!");
        }

        break;
      default:
        console.log("No transaction with this ID exists!");

        break;
    }

    console.log();

    exitPrompt: while (true) {
      const isContinuing = (await prompt("Back to the Main Menu (Y/N): ")).toUpperCase();

      if (isContinuing.toUpperCase() === "Y") {
        console.log();

        break exitPrompt;
      } else if (isContinuing.toUpperCase() === "N") {
        break mainMenu;
      } else {
        console.log("Only accepting a [Y]es or [N]o answer!");

        console.log();
      }
    }
  }
})();
