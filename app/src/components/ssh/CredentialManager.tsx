import { useEffect, useState } from "react";
import { useSSH } from "../../hooks/useSSH";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Trash2, Key, Plus } from "lucide-react";
import { toast } from "sonner";

export function CredentialManager() {
  const {
    keys,
    fetchKeys,
    addKey,
    deleteKey,
    loading,
  } = useSSH();

  const [isOpen, setIsOpen] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [privateKey, setPrivateKey] = useState("");

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleAdd = async () => {
    if (!name || !privateKey) {
      toast.error("Please fill all fields");
      return;
    }

    const success = await addKey({ name, privateKey });
    if (success) {
      setIsOpen(false);
      setName("");
      setPrivateKey("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">SSH Keys</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add SSH Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add SSH Key</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="col-span-3"
                  placeholder="production-server"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="key" className="text-right">
                  Private Key
                </Label>
                <Textarea
                  id="key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  className="col-span-3 font-mono text-xs"
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                  rows={8}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleAdd} disabled={loading}>
                Save SSH Key
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {keys.map((key) => (
          <Card key={key.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {key.name}
              </CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-4">
                Added: {new Date(key.created_at).toLocaleDateString()}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => deleteKey(key.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {keys.length === 0 && !loading && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            No SSH keys found. Add one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
