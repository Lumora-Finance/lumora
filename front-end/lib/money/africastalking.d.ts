declare module "africastalking" {
  type Client = {
    SMS: { send(options: { to: string[]; message: string; from?: string }): Promise<unknown> };
  };
  export default function AfricasTalking(options: { username: string; apiKey: string }): Client;
}
