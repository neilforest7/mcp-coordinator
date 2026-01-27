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
import { Machine } from "../../types/machine";

interface EditMachineDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    machine: Machine | null;
    onUpdated?: () => void;
}

export function EditMachineDialog({ open, onOpenChange, machine, onUpdated }: EditMachineDialogProps) {
    const { updateMachine } = useMachines();
    const { keys, fetchKeys } = useSSH();
    const [name, setName] = useState("");
    const [host, setHost] = useState("");
    const [username, setUsername] = useState("");
    const [port, setPort] = useState("22");
    const [platform, setPlatform] = useState("linux");
    const [sshKeyId, setSshKeyId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    
    const isLocal = machine?.id === "local";

    useEffect(() => {
        if (open) {
            fetchKeys();
        }
    }, [open, fetchKeys]);

    useEffect(() => {
        if (machine && open) {
            setName(machine.name);
            setHost(machine.host || "");
            setUsername(machine.username || "");
            setPort(machine.port?.toString() || "22");
            setPlatform(machine.platform || "linux");
            if (machine.sshKeyId) {
                setSshKeyId(machine.sshKeyId.toString());
            }
        }
    }, [machine, open]);

    const handleSubmit = async () => {
        if (!machine) return;
        
        // For remote machines, require SSH key
        if (!isLocal && !sshKeyId) {
            return;
        }
        
        setLoading(true);
        const success = await updateMachine(
            machine.id, 
            name, 
            host, 
            username, 
            parseInt(sshKeyId) || 0, // 0 or default for local
            parseInt(port) || 22,
            platform
        );
        setLoading(false);
        if (success) {
            onUpdated?.();
            onOpenChange(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isLocal ? "Edit Local Machine" : "Edit Remote Machine"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="My Server" />
                    </div>
                    
                    {!isLocal && (
                        <>
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
                        </>
                    )}
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Platform</Label>
                        <Select value={platform} onValueChange={setPlatform}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select Platform" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="linux">Linux</SelectItem>
                                <SelectItem value="macos">macOS</SelectItem>
                                <SelectItem value="windows">Windows</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {!isLocal && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Port</Label>
                            <Input value={port} onChange={e => setPort(e.target.value)} className="col-span-3" type="number" />
                        </div>
                    )}
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={loading || (!isLocal && !sshKeyId)}>Save Changes</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
