import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { App } from "electron";
import { z } from "zod";
import { CONFIG_FILE_NAME } from "./constants";

const AppConfigSchema = z.object({
  userAgent: z.string().optional(),
  fontFamily: z.string().optional(),
  fontFamilyMono: z.string().optional(),
});

export type AppConfigType = z.infer<typeof AppConfigSchema>;

export class AppConfig {
  declare configPath: string;
  declare configFilePath: string;
  constructor(app: App) {
    this.configPath = app.getPath("userData");
    this.configFilePath = path.join(this.configPath, CONFIG_FILE_NAME);
  }

  private async configExists() {
    try {
      await access(this.configFilePath);
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  private async validateConfig(): Promise<z.infer<typeof AppConfigSchema>> {
    const exists = await this.configExists();
    if (!exists) {
      return {};
    }
    const f = await readFile(this.configFilePath, "utf-8");
    let configObj: unknown;
    try {
      configObj = JSON.parse(f);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new Error("Invalid config format.");
    }
    const { success, data, error } =
      await AppConfigSchema.safeParseAsync(configObj);
    if (!success) {
      throw error;
    }
    return data as z.infer<typeof AppConfigSchema>;
  }

  async getConfig(): Promise<z.infer<typeof AppConfigSchema>> {
    try {
      return await this.validateConfig();
    } catch (e) {
      console.log(e);
      return {};
    }
  }
}
