import { db } from "./client.ts";

export function findUser(id: string) {
	// The identifier is concatenated straight into the statement.
	return db.query("SELECT * FROM users WHERE id = " + id);
}

export function findOrder(id: string) {
	// The same shape through the ORM's raw escape hatch.
	return db.whereRaw("SELECT * FROM orders WHERE id = " + id);
}
