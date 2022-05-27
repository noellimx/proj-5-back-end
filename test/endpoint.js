import assert from "assert";

import request from "supertest";
import crypto from "crypto";
import app from "../express/index.js";

const username = "user1" + crypto.randomUUID().toString().slice(0, 6);
const password = "tss";

const gettokenResponse = async () => {
  const res = await request(app)
    .get("/login")
    .set("Accept", "application/json")
    .query({ email: username, password });

  return res;
};

const getToken = async () => {
  const res = await gettokenResponse();
  return res.body.token;
};

const httpGetAllTransactions = async (app, token) =>
  await request(app)
    .get("/all-transactions")
    .set("Accept", "application/json")
    .send({
      token,
    });

describe("GET /is-server-online", () => {
  it("should echo 200", (done) => {
    request(app)
      .get("/is-server-online")
      .set("Accept", "application/json")
      .expect(200, done);
  });
});

describe("User Story 1+ ", async () => {
  it("should register user", async () => {
    const res = await request(app)
      .post("/register")
      .set("Accept", "application/json")
      .send({ username, password, password2: password });

    assert.strictEqual(res.status, 200);
  });

  it("should login registered user", async () => {
    const res = await gettokenResponse();
    assert.strictEqual(res.status, 200);
  });

  it("Server should provision an access token", async () => {
    const res = await gettokenResponse();

    assert.strictEqual(200, res.status);

    const { body } = res;
    const { token } = body;

    assert.ok(!!body);
    assert.ok(!!token);
  });
});

describe("transactions", async () => {
  it("[001]Should be able to record a transaction ", async () => {
    // Login

    const _res = await gettokenResponse();
    const token = _res.body.token;
    const usernameReceived = _res.body.username;
    assert(!!token);
    assert(usernameReceived, username);

    // Malformed Request
    const resOfMalformedRequest = await request(app)
      .post("/track-transaction")
      .set("Accept", "application/json")
      .send({
        token,
        transactionType: "asdfkusgadfasdf",
        transactionHash:
          "0xf9e10f158459c93624f8b76b81649c4911d6abb846f89d68b59c3ff4a4163dd9",
      });

    // Record 3 transactions - START
    assert.strictEqual(400, resOfMalformedRequest.status);
    const resOfTransaction_Buy1 = await request(app)
      .post("/track-transaction")
      .set("Accept", "application/json")
      .send({
        token,
        transactionType: "BUY",
        transactionHash:
          "0x69fc14a5f3bd93253a4446e7fb70ded1b25ab1f7fdb525b8180ef944f9b56c73",
      });

    const resOfTransaction_Buy2 = await request(app)
      .post("/track-transaction")
      .set("Accept", "application/json")
      .send({
        token,
        transactionType: "BUY",
        transactionHash:
          "0x607e05812d36d29dde45585da542bbe546596f1a342d814e5496f8f951d8b59a",
      });

    const resOfTransaction_Sell = await request(app)
      .post("/track-transaction")
      .set("Accept", "application/json")
      .send({
        token,
        transactionType: "SELL",
        transactionHash:
          "0x53285927aeb2594eaa5af6d9bd8560b4abcf7e6795ae40450496770d47e075ac",
      });

    assert.strictEqual(200, resOfTransaction_Buy1.status);
    assert.strictEqual(200, resOfTransaction_Buy2.status);
    assert.strictEqual(200, resOfTransaction_Sell.status);
    // Record 3 transactions - END

    await (async () => {
      assert.notStrictEqual(null, resOfTransaction_Buy2.body.transactions);
      assert.notStrictEqual(undefined, resOfTransaction_Buy2.body.transactions);
      const { transactions } = resOfTransaction_Buy2.body;

      assert(Array.isArray(transactions));

      assert.strictEqual(1, transactions.length);

      /** @type {TransactionFE} */
      const transaction = transactions[0];
      console.log(" -----[001] checkpoint 1 ");

      assert(!!transaction.id);

      const resOfTransaction_ViewBuy = await request(app)
        .get("/get-transaction")
        .set("Accept", "application/json")
        .send({
          token,
          dbtransactionId: transaction.id,
        });
      console.log(
        " -----[001] resOfTransaction_ViewBuy Should return status 200"
      );

      assert.strictEqual(200, resOfTransaction_ViewBuy.status);

      assert.strictEqual(
        "0x607e05812d36d29dde45585da542bbe546596f1a342d814e5496f8f951d8b59a",
        transaction.hash
      );
      console.log("123124125151256");
      console.log(transaction);
      assert.strictEqual(80, transaction.qty);

      assert.strictEqual("ETH", transaction.network);
      assert.strictEqual("BUY", transaction.transactionType);
      assert.notStrictEqual(null, transaction.txValue);
      assert.notStrictEqual(undefined, transaction.txValue);

      const { txValue } = transaction;
      console.log(txValue);

      assert.notStrictEqual(null, transaction.currentValue);
      assert.notStrictEqual(undefined, transaction.currentValue);

      const { currentValue } = transaction;

      console.log(currentValue);

      const { stats } = resOfTransaction_Buy2.body;

      assert.notStrictEqual(null, stats);
      assert.notStrictEqual(undefined, stats);

      assert.notStrictEqual(null, stats.outlay);
      assert.notStrictEqual(undefined, stats.outlay);
      assert.notStrictEqual(null, stats.unrealrev);
      assert.notStrictEqual(undefined, stats.unrealrev);
      assert(!Number.isNaN(Number(stats.unrealrev.toFixed(3))));
      assert.strictEqual(0, Number(stats.saleoutlay.toFixed(3)));
    })();

    /**
     * Get the transactions
     */

    const allTransactionsResponse = await httpGetAllTransactions(app, token);
    assert.strictEqual(200, allTransactionsResponse.status);

    await (async () => {
      const { transactions } = allTransactionsResponse.body;
      assert.strictEqual(3, transactions.length);

      const transactionBuyIdFromTrackedTransaction =
        resOfTransaction_Buy1.body.transactions[0].id;
      const firstTransactionIdReceivedFromGetAllTransactions =
        transactions[0].id;
      assert.strictEqual(
        firstTransactionIdReceivedFromGetAllTransactions,
        transactionBuyIdFromTrackedTransaction
      );

      const viewBuyTransactionResponse = await request(app)
        .get("/get-transaction")
        .set("Accept", "application/json")
        .send({
          token,
          dbtransactionId: firstTransactionIdReceivedFromGetAllTransactions,
        });
      assert.strictEqual(200, viewBuyTransactionResponse.status);
      const deleteBuyTransactionResponse = await request(app)
        .delete("/transaction")
        .set("Accept", "application/json")
        .send({
          token,
          dbtransactionId: firstTransactionIdReceivedFromGetAllTransactions,
        });

      assert.strictEqual(200, deleteBuyTransactionResponse.status);
    })();

    const allTxCountAfterDeleteOne = (await httpGetAllTransactions(app, token))
      .body.transactions.length;

    assert.strictEqual(2, allTxCountAfterDeleteOne);

    await (async () => {
      const allTransactionsFilterByNetworkETH = await request(app)
        .get("/all-transactions")
        .set("Accept", "application/json")
        .send({
          token,
          filterBy: {
            column: "Network",
            params: ["ETH"],
          },
        });

      assert.strictEqual(200, allTransactionsFilterByNetworkETH.status);
      assert.strictEqual(
        2,
        allTransactionsFilterByNetworkETH.body.transactions.length
      );

      const allTransactionsFilterByNetworkBTC = await request(app)
        .get("/all-transactions")
        .set("Accept", "application/json")
        .send({
          token,
          filterBy: {
            column: "Network",
            params: ["BTC"],
          },
        });

      assert.strictEqual(200, allTransactionsFilterByNetworkBTC.status);
      assert.strictEqual(
        0,
        allTransactionsFilterByNetworkBTC.body.transactions.length
      );

      const allTransactionsFilterByNetworkBTCAndETH = await request(app)
        .get("/all-transactions")
        .set("Accept", "application/json")
        .send({
          token,
          filterBy: {
            column: "Network",
            params: ["BTC", "ETH"],
          },
        });

      assert.strictEqual(200, allTransactionsFilterByNetworkBTCAndETH.status);
      assert.strictEqual(
        2,
        allTransactionsFilterByNetworkBTCAndETH.body.transactions.length
      );
    })();

    await (async () => {
      const ranges = [
        ["2022-05-18", "2022-05-20", 2],
        ["2022-05-18", "2022-05-19", 1],
        ["2022-05-19", "2022-05-20", 1],
      ];
      for await (const [from, to, expectedCount] of ranges) {
        const allTransactionsFilterByDate = await request(app)
          .get("/all-transactions")
          .set("Accept", "application/json")
          .send({
            token,
            filterBy: {
              column: "Date",
              params: [from, to],
            },
          });

        assert.strictEqual(200, allTransactionsFilterByDate.status);
        assert.strictEqual(
          expectedCount,
          allTransactionsFilterByDate.body.transactions.length
        );
      }
    })();

    await (async () => {})();
  }).timeout(0);
});

describe("views", async () => {
  it("should register new view (return 200)", async () => {
    const token = await getToken();
    const allTransactions = await request(app)
      .get("/all-transactions")
      .set("Accept", "application/json")
      .send({ token });

    assert.strictEqual(200, allTransactions.status);
    const transactionIds = allTransactions.body.transactions.map(
      ({ id }) => id
    );
    assert.strictEqual(2, transactionIds.length);

    const newViewResponse = await request(app)
      .post("/new-view")
      .set("Accept", "application/json")
      .send({ token, transactionIds });

    assert.strictEqual(200, newViewResponse.status);
  });
});
