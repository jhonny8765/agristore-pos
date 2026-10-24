# Staff access and branch responsibilities

The owner assigns an existing employee account to a branch and role under Settings. Staff work with their assigned branch's records; the owner can select every branch. The product catalog, units, lots and suppliers are shared within the business. A transfer touching an employee's branch can identify the other branch, without granting access to that branch's unrelated records.

| Operation | Owner | Branch manager | Cashier | Stock staff |
|---|---|---|---|---|
| Open a cashier shift and make cash sales | Yes | Assigned branch | Assigned branch | No |
| Receive purchased stock | Yes | Assigned branch | No | Assigned branch |
| Import verified opening stock | Yes | No | No | No |
| Dispatch an interbranch transfer | Yes | Assigned branch | No | No |
| Confirm a transfer addressed to the branch | Yes | Assigned branch | No | Assigned branch |
| Submit a physical stock count after shifts close | Yes | Assigned branch | No | Assigned branch |
| Approve a count adjustment | Yes | No | No | No |
| Create products or change prices | Yes | No | No | No |
| Authorize a cash refund | Yes, with own open shift | No | No | No |
| Assign/revoke staff or add/rename branches | Yes | No | No | No |

Online stock changes still require a connection and server authorization. A disabled button helps prevent a mistaken action; the database enforces the same restriction if someone bypasses the interface. Direct edits to the stock projection and staff membership tables are denied, including attempts to promote oneself to owner.

For example, Magpet's cashier can see a transfer addressed to Magpet but cannot confirm its stock receipt. Magpet's manager or stock staff performs that step. The cashier cannot open Mlang's unrelated purchasing/count history by substituting its branch ID in a request. Incoming and outgoing transfer information remains available when it belongs to the assigned branch.

Use separate employee accounts during the one-branch pilot rehearsal. Test each person's assigned branch, permitted stock task and prohibited actions. This guide describes the application rules; the owner must still confirm the real staff assignments and reconcile stock/cash before live use.
