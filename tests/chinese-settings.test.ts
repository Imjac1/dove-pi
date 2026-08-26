import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { buildChineseSettingsItems } from "../src/pi-adapter/chinese-settings.ts";

describe("Chinese Pi settings", () => {
	it("exposes translated labels and persists the selected setting", async () => {
		const manager = SettingsManager.inMemory({ quietStartup: false, theme: "dark" });
		const { items, onChange } = buildChineseSettingsItems(manager, ["dark", "light"]);

		assert.equal(items.find((item) => item.id === "quiet-startup")?.label, "安静启动");
		assert.equal(items.find((item) => item.id === "quiet-startup")?.currentValue, "关闭");
		assert.equal(items.find((item) => item.id === "theme")?.label, "主题");

		onChange("quiet-startup", "开启");
		await manager.flush();
		assert.equal(manager.getQuietStartup(), true);
	});
});
