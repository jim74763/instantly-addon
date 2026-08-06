import { Button } from "@/components/ui/button";

export function PaginationActions({
  hasMore,
  isLoading,
  isLoadingAll,
  onLoadMore,
  onLoadAll,
}: {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingAll: boolean;
  onLoadMore: () => void;
  onLoadAll: () => void;
}) {
  if (!hasMore) {
    return null;
  }

  return (
    <div className="mt-4 flex justify-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onLoadMore}
        disabled={isLoading || isLoadingAll}
      >
        Show more
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onLoadAll}
        disabled={isLoading || isLoadingAll}
      >
        {isLoadingAll ? "Loading all" : "Load all"}
      </Button>
    </div>
  );
}
