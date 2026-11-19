// The browser half of a passkey ceremony. Tokens never reach the browser: it only turns the server's
// options into a credential and sends that back to a server action.

type Json = Record<string, unknown>;

interface PublicKeyCredentialStatics {
  parseCreationOptionsFromJSON(options: Json): PublicKeyCredentialCreationOptions;
  parseRequestOptionsFromJSON(options: Json): PublicKeyCredentialRequestOptions;
}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

const statics = () => PublicKeyCredential as unknown as PublicKeyCredentialStatics;

export async function createPasskey(options: unknown): Promise<unknown> {
  const publicKey = statics().parseCreationOptionsFromJSON(options as Json);
  const credential = (await navigator.credentials.create({
    publicKey
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("No passkey was created.");
  return credential.toJSON();
}

export async function getPasskey(options: unknown): Promise<unknown> {
  const publicKey = statics().parseRequestOptionsFromJSON(options as Json);
  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("No passkey was chosen.");
  return credential.toJSON();
}
