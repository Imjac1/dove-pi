import type { SettingsManager, Theme } from "@earendil-works/pi-coding-agent";
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, SettingsList, Spacer, Text, type SettingItem } from "@earendil-works/pi-tui";

type UiTheme = Pick<Theme, "fg" | "bold">;

const BOOL_VALUES = ["开启", "关闭"];

const boolText = (value: boolean): string => (value ? "开启" : "关闭");
const boolValue = (value: string): boolean => value === "开启";

function cycleMap<T extends string>(entries: readonly (readonly [T, string])[], value: T): { current: string; values: string[]; read: (label: string) => T } {
	const byValue = new Map(entries);
	const byLabel = new Map(entries.map(([raw, label]) => [label, raw] as const));
	return {
		current: byValue.get(value) ?? String(value),
		values: entries.map(([, label]) => label),
		read: (label) => byLabel.get(label) ?? value,
	};
}

export function buildChineseSettingsItems(manager: SettingsManager, themes: readonly string[]): {
	items: SettingItem[];
	onChange: (id: string, newValue: string) => void;
} {
	const trust = cycleMap([
		["ask", "询问"],
		["always", "始终信任"],
		["never", "从不信任"],
	] as const, manager.getDefaultProjectTrust());
	const steering = cycleMap([
		["one-at-a-time", "逐条发送"],
		["all", "一次全部发送"],
	] as const, manager.getSteeringMode());
	const followUp = cycleMap([
		["one-at-a-time", "逐条发送"],
		["all", "一次全部发送"],
	] as const, manager.getFollowUpMode());
	const transport = cycleMap([
		["auto", "自动"],
		["sse", "SSE"],
		["websocket", "WebSocket"],
		["websocket-cached", "WebSocket（缓存）"],
	] as const, manager.getTransport());
	const mermaid = cycleMap([
		["off", "关闭"],
		["final", "完成后渲染"],
		["streaming", "流式渲染"],
	] as const, manager.getMermaidRenderingMode());
	const tuiMode = cycleMap([
		["regular", "普通模式"],
		["fullscreen", "全屏模式"],
	] as const, manager.getTuiMode());
	const fullscreenExit = cycleMap([
		["transcript", "输出完整记录"],
		["resume-hint", "只输出恢复提示"],
	] as const, manager.getFullscreenExitOutput());
	const scrollbar = cycleMap([
		["auto", "自动"],
		["always", "始终显示"],
		["hidden", "隐藏"],
	] as const, manager.getFullscreenScrollbar());
	const doubleEscape = cycleMap([
		["tree", "打开会话树"],
		["fork", "创建分支"],
		["none", "无操作"],
	] as const, manager.getDoubleEscapeAction());
	const treeFilter = cycleMap([
		["default", "默认"],
		["no-tools", "隐藏工具"],
		["user-only", "仅用户消息"],
		["labeled-only", "仅带标签消息"],
		["all", "全部"],
	] as const, manager.getTreeFilterMode());

	const items: SettingItem[] = [
		{ id: "autocompact", label: "自动压缩上下文", description: "上下文过大时自动压缩", currentValue: boolText(manager.getCompactionEnabled()), values: BOOL_VALUES },
		{ id: "show-images", label: "显示图片", description: "在终端中内嵌显示图片", currentValue: boolText(manager.getShowImages()), values: BOOL_VALUES },
		{ id: "auto-resize-images", label: "自动调整图片大小", description: "将大图片调整到最大 2000×2000，提升模型兼容性", currentValue: boolText(manager.getImageAutoResize()), values: BOOL_VALUES },
		{ id: "block-images", label: "阻止发送图片", description: "不将图片发送给模型服务商", currentValue: boolText(manager.getBlockImages()), values: BOOL_VALUES },
		{ id: "skill-commands", label: "技能命令", description: "将技能注册为 /skill:名称 命令", currentValue: boolText(manager.getEnableSkillCommands()), values: BOOL_VALUES },
		{ id: "show-hardware-cursor", label: "显示硬件光标", description: "显示终端光标，同时保留输入法定位支持", currentValue: boolText(manager.getShowHardwareCursor()), values: BOOL_VALUES },
		{ id: "steering-mode", label: "引导消息模式", description: "模型输出过程中输入的引导消息如何排队", currentValue: steering.current, values: steering.values },
		{ id: "follow-up-mode", label: "追问消息模式", description: "模型停止后排队的追问消息如何发送", currentValue: followUp.current, values: followUp.values },
		{ id: "transport", label: "网络传输方式", description: "服务商支持多种传输方式时的首选项", currentValue: transport.current, values: transport.values },
		{ id: "hide-thinking", label: "隐藏思考过程", description: "隐藏助手回复中的思考块", currentValue: boolText(manager.getHideThinkingBlock()), values: BOOL_VALUES },
		{ id: "mermaid-rendering", label: "Mermaid 图表", description: "将 Mermaid 代码块渲染为 Unicode 图表", currentValue: mermaid.current, values: mermaid.values },
		{ id: "cache-miss-notices", label: "缓存未命中提示", description: "显示重要提示缓存未命中和压缩成本", currentValue: boolText(manager.getShowCacheMissNotices()), values: BOOL_VALUES },
		{ id: "collapse-changelog", label: "折叠更新日志", description: "更新后显示精简版更新日志", currentValue: boolText(manager.getCollapseChangelog()), values: BOOL_VALUES },
		{ id: "quiet-startup", label: "安静启动", description: "关闭启动时的详细输出", currentValue: boolText(manager.getQuietStartup()), values: BOOL_VALUES },
		{ id: "install-telemetry", label: "安装遥测", description: "更新后发送匿名版本/更新提示", currentValue: boolText(manager.getEnableInstallTelemetry()), values: BOOL_VALUES },
		{ id: "default-project-trust", label: "项目默认信任策略", description: "没有其他决定时，项目资源信任的回退策略", currentValue: trust.current, values: trust.values },
		{ id: "double-escape-action", label: "双击 Esc 的操作", description: "编辑器为空时连续按两次 Esc 的操作", currentValue: doubleEscape.current, values: doubleEscape.values },
		{ id: "tree-filter-mode", label: "会话树过滤模式", description: "打开 /tree 时使用的默认过滤方式", currentValue: treeFilter.current, values: treeFilter.values },
		{ id: "tui-mode", label: "终端界面模式", description: "界面布局；全屏模式仍是实验功能", currentValue: tuiMode.current, values: tuiMode.values },
		{ id: "fullscreen-exit-output", label: "退出全屏时的输出", description: "退出全屏时输出完整记录，或只输出恢复提示", currentValue: fullscreenExit.current, values: fullscreenExit.values },
		{ id: "fullscreen-scrollbar", label: "全屏滚动条", description: "全屏模式下滚动条的显示方式", currentValue: scrollbar.current, values: scrollbar.values },
		{ id: "image-width-cells", label: "图片宽度", description: "终端内嵌图片的首选宽度（字符格）", currentValue: String(manager.getImageWidthCells()), values: ["60", "80", "120"] },
		{ id: "editor-padding", label: "编辑器边距", description: "输入编辑器的水平边距（0-3）", currentValue: String(manager.getEditorPaddingX()), values: ["0", "1", "2", "3"] },
		{ id: "output-padding", label: "输出边距", description: "用户消息、助手消息和思考内容的水平边距", currentValue: String(manager.getOutputPad()), values: ["0", "1"] },
		{ id: "autocomplete-max-visible", label: "补全最大条数", description: "补全下拉框最多显示的条目数（3-20）", currentValue: String(manager.getAutocompleteMaxVisible()), values: ["3", "5", "7", "10", "15", "20"] },
		{ id: "clear-on-shrink", label: "内容变短时清除空行", description: "内容缩短时清除多余空行，可能造成闪烁", currentValue: boolText(manager.getClearOnShrink()), values: BOOL_VALUES },
		{ id: "terminal-progress", label: "终端进度提示", description: "在终端标签栏显示 OSC 9;4 进度指示器", currentValue: boolText(manager.getShowTerminalProgress()), values: BOOL_VALUES },
		{ id: "anthropic-extra-usage", label: "Anthropic 额外用量提示", description: "订阅认证可能产生付费额外用量时显示警告", currentValue: boolText(manager.getWarnings().anthropicExtraUsage !== false), values: BOOL_VALUES },
		{ id: "theme", label: "主题", description: "界面的颜色主题（主题名称保持原样）", currentValue: manager.getTheme() ?? themes[0] ?? "dark", values: [...themes] },
	];

	const onChange = (id: string, newValue: string): void => {
		switch (id) {
			case "autocompact": manager.setCompactionEnabled(boolValue(newValue)); break;
			case "show-images": manager.setShowImages(boolValue(newValue)); break;
			case "auto-resize-images": manager.setImageAutoResize(boolValue(newValue)); break;
			case "block-images": manager.setBlockImages(boolValue(newValue)); break;
			case "skill-commands": manager.setEnableSkillCommands(boolValue(newValue)); break;
			case "show-hardware-cursor": manager.setShowHardwareCursor(boolValue(newValue)); break;
			case "steering-mode": manager.setSteeringMode(steering.read(newValue)); break;
			case "follow-up-mode": manager.setFollowUpMode(followUp.read(newValue)); break;
			case "transport": manager.setTransport(transport.read(newValue)); break;
			case "hide-thinking": manager.setHideThinkingBlock(boolValue(newValue)); break;
			case "mermaid-rendering": manager.setMermaidRenderingMode(mermaid.read(newValue)); break;
			case "cache-miss-notices": manager.setShowCacheMissNotices(boolValue(newValue)); break;
			case "collapse-changelog": manager.setCollapseChangelog(boolValue(newValue)); break;
			case "quiet-startup": manager.setQuietStartup(boolValue(newValue)); break;
			case "install-telemetry": manager.setEnableInstallTelemetry(boolValue(newValue)); break;
			case "default-project-trust": manager.setDefaultProjectTrust(trust.read(newValue)); break;
			case "double-escape-action": manager.setDoubleEscapeAction(doubleEscape.read(newValue)); break;
			case "tree-filter-mode": manager.setTreeFilterMode(treeFilter.read(newValue)); break;
			case "tui-mode": manager.setTuiMode(tuiMode.read(newValue)); break;
			case "fullscreen-exit-output": manager.setFullscreenExitOutput(fullscreenExit.read(newValue)); break;
			case "fullscreen-scrollbar": manager.setFullscreenScrollbar(scrollbar.read(newValue)); break;
			case "image-width-cells": manager.setImageWidthCells(Number(newValue)); break;
			case "editor-padding": manager.setEditorPaddingX(Number(newValue)); break;
			case "output-padding": manager.setOutputPad(newValue === "0" ? 0 : 1); break;
			case "autocomplete-max-visible": manager.setAutocompleteMaxVisible(Number(newValue)); break;
			case "clear-on-shrink": manager.setClearOnShrink(boolValue(newValue)); break;
			case "terminal-progress": manager.setShowTerminalProgress(boolValue(newValue)); break;
			case "anthropic-extra-usage": manager.setWarnings({ ...manager.getWarnings(), anthropicExtraUsage: boolValue(newValue) }); break;
			case "theme": manager.setTheme(newValue); break;
		}
		void manager.flush();
	};

	return { items, onChange };
}

function translateHint(line: string): string {
	return line
		.replace("No settings available", "没有可用设置")
		.replace("No matching settings", "没有匹配的设置")
		.replace("Type to search · Enter/Space to change · Esc to cancel", "输入可搜索 · 回车/空格切换 · Esc 取消")
		.replace("Enter/Space to change · Esc to cancel", "回车/空格切换 · Esc 取消");
}

export function createChineseSettingsComponent(
	manager: SettingsManager,
	themes: readonly string[],
	uiTheme: UiTheme,
	done: () => void,
): { render: (width: number) => string[]; invalidate: () => void; handleInput: (data: string) => void } {
	const { items, onChange } = buildChineseSettingsItems(manager, themes);
	const container = new Container();
	container.addChild(new Text(uiTheme.fg("accent", uiTheme.bold("Pi 设置（中文）")), 0, 0));
	container.addChild(new Spacer(1));
	const settingsList = new SettingsList(items, 12, getSettingsListTheme(), onChange, done, { enableSearch: true });
	container.addChild(settingsList);
	return {
		render: (width) => container.render(width).map(translateHint),
		invalidate: () => container.invalidate(),
		handleInput: (data) => settingsList.handleInput(data),
	};
}
