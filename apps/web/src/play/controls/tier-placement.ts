export type TierPlacement = { itemId: string; tierId: string };

export function assignTier(
  current: TierPlacement[],
  itemId: string,
  tierId: string,
  ties: "forbidden" | "shared",
): TierPlacement[] {
  const withoutItem = current.filter((placement) => placement.itemId !== itemId);
  const withoutTier =
    ties === "forbidden"
      ? withoutItem.filter((placement) => placement.tierId !== tierId)
      : withoutItem;
  return [...withoutTier, { itemId, tierId }];
}
