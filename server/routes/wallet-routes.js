const { Router } = require("express");
const { get, all, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");
const { authMiddleware } = require("../middleware/auth");
const { badRequest } = require("../lib/http-error");

const walletRouter = Router();

walletRouter.use(authMiddleware);

walletRouter.get(
  "/api/wallet",
  asyncHandler(async (req, res) => {
    const user = await get("SELECT balance FROM users WHERE id = ?", [req.user.id]);
    
    const transactions = await all(
      "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [req.user.id]
    );

    res.json({
      balance: user ? user.balance : 0,
      transactions: transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        description: t.description,
        createdAt: t.created_at
      }))
    });
  })
);

walletRouter.post(
  "/api/wallet/topup",
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0 || amount > 1000000) {
      throw badRequest("Некорректная сумма пополнения");
    }

    await run("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, req.user.id]);
    await run(
      "INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, 'income', ?)",
      [req.user.id, amount, "Пополнение баланса (Демо)"]
    );

    const user = await get("SELECT balance FROM users WHERE id = ?", [req.user.id]);
    res.json({ ok: true, balance: user.balance });
  })
);

module.exports = { walletRouter };
