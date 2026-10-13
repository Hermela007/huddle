export function splitEqually(
    amountPence:number,
    memberIds: string[]
): Record<string, number> {

    if (memberIds.length === 0) {
        throw new Error("Need at least one person to split between");
    }
    if (amountPence <= 0) {
        throw new Error("Amount must be more than 0");
    }
    
    const base = Math.floor(amountPence / memberIds.length);
    const leftOver = amountPence % memberIds.length;
    const shares: Record<string, number> = {};
    for (let i = 0; i < memberIds.length; i++) {
        if (i < leftOver) {
            shares[memberIds[i]] = base + 1;
        }
        else {
            shares[memberIds[i]] = base; 
        }
    }    
    return shares 
}