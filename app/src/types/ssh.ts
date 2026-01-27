export interface SSHKey {
  id: number;
  name: string;
  created_at: string;
}

export interface AddSSHKeyParams {
  name: string;
  privateKey: string;
}
