import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useMachines } from "../../hooks/useMachines";
import { useSSH } from "../../hooks/useSSH";

interface AddMachineDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdded?: () => void;
}

export function AddMachineDialog({ open, onOpenChange, onAdded }: AddMachineDialogProps) {
    const { addMachine } = useMachines();
    const { keys, fetchKeys } = useSSH();
    const [name, setName] = useState("");
    const [host, setHost] = useState("");
    const [username, setUsername] = useState("");
    const [port, setPort] = useState("22");
    const [platform, setPlatform] = useState("linux");
    const [sshKeyId, setSshKeyId] = useState<string>("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchKeys();
        }
    }, [open, fetchKeys]);

    const handleSubmit = async () => {
        if (!sshKeyId) {
            return;
        }
        setLoading(true);
        const success = await addMachine(name, host, username, parseInt(sshKeyId), parseInt(port) || 22, platform);
        setLoading(false);
        if (success) {
            onAdded?.();
            onOpenChange(false);
            setName("");
            setHost("");
            setUsername("");
            setSshKeyId("");
            setPort("22");
            setPlatform("linux");
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Remote Machine</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="My Server" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Host</Label>
                        <Input value={host} onChange={e => setHost(e.target.value)} className="col-span-3" placeholder="192.168.1.100" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Username</Label>
                        <Input value={username} onChange={e => setUsername(e.target.value)} className="col-span-3" placeholder="root" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">SSH Key</Label>
                        <Select value={sshKeyId} onValueChange={setSshKeyId}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select SSH key" />
                            </SelectTrigger>
                            <SelectContent>
                                {keys.map(key => (
                                    <SelectItem key={key.id} value={key.id.toString()}>
                                        {key.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Platform</Label>
                        <Select value={platform} onValueChange={setPlatform}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select Platform" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="linux">Linux / macOS</SelectItem>
                                <SelectItem value="windows">Windows</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Port</Label>
                        <Input value={port} onChange={e => setPort(e.target.value)} className="col-span-3" type="number" />
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={loading || !sshKeyId}>Add Machine</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
