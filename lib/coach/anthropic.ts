import Anthropic from "@anthropic-ai/sdk";
let c: Anthropic | null = null;
export function getAnthropic() { return (c ??= new Anthropic()); }
