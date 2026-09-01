import { deliverNotification } from "../notification.service.js";

interface ResultWithNotification<T> {
  value: T;
  notificationId?: number;
}

export async function deliverAfterCommit<T>(
  result: ResultWithNotification<T>,
): Promise<T> {
  if (result.notificationId !== undefined) {
    await deliverNotification(result.notificationId);
  }

  return result.value;
}
