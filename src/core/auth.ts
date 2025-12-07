import type { AuthResponse } from "../types";
import { APIClient } from "./api-client";

export class AuthManager {
  private apiClient: APIClient;
  private apiKey: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey;
    this.apiClient = new APIClient(baseURL);
  }

  async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      Date.now() < this.tokenExpiresAt
    ) {
      return this.accessToken;
    }

    await this.authenticate();
    return this.accessToken!;
  }

  private async authenticate(): Promise<void> {
    const response = await this.apiClient.get<AuthResponse>(
      "/sdk-auth/authenticate",
      {
        "X-Timely-API": this.apiKey,
      }
    );

    if (!response.success || !response.data.access_token) {
      throw new Error("Failed to authenticate with API key");
    }

    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + 55 * 60 * 1000;
  }

  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }
}
