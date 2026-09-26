import { exec } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

export function renderReport(name: string) {
	// The name reaches a shell.
	return exec("render " + name);
}

export function saveUpload(req: any, file: any) {
	// The stored name and the destination both come from the request.
	const target = path.join("/srv/uploads", file.originalname);
	writeFileSync(target, req.body);
}
