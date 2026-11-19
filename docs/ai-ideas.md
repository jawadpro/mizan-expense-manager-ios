# AI ideas on the Savings plan

The Savings plan page can ask OpenAI for a few personal ideas on saving more and growing your money, based on
your own figures. It's off until you add a key, and it only runs when you tap **Get AI suggestions**.

## Turn it on

1. Create a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys) and set a monthly spend
   limit under **Billing**.
2. Add it to the server's environment as `OPENAI_API_KEY` (Vercel: Project › Settings › Environment Variables;
   self-hosting: your `.env`), then redeploy or restart.
3. Optional: `OPENAI_MODEL` picks the model. The default is `gpt-5-mini`.

The key stays on the server. The browser never sees it.

## What is sent

Only the totals the Savings plan page already shows, in whole rupees (or your currency):

- usual monthly income and spending, and spending per category
- the last six months' income, spending and what was left over
- this month so far
- your savings target, what's set aside, and your balance
- the names and amounts of your monthly payments (long digit runs, like card numbers, are masked)
- the titles of the tips Mizan already shows, so the AI adds something new

Never sent: SMS text, account or card numbers, transaction payees, or your name. OpenAI doesn't train on API data.

## Cost and limits

About 1,500 tokens in and 1,000 to 1,500 out (including the model's thinking) per request: under Rs 1 on `gpt-5-mini`. The last answer is kept (encrypted)
for each bank choice, so reopening the page is free. At most 10 requests an hour.
