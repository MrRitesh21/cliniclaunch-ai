/**
 * Enterprise Event-Driven Bus for ClinicX
 * Publishes and subscribes to domain events (AppointmentCreated, PaymentReceived, etc.).
 */

export type DomainEventType =
  | "AppointmentCreated"
  | "PatientCreated"
  | "PaymentReceived"
  | "ReviewRequested"
  | "InventoryUpdated";

export interface DomainEvent<T = unknown> {
  id: string;
  type: DomainEventType;
  tenantId: string;
  payload: T;
  timestamp: string;
}

type EventHandler<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

class EventBusEngine {
  private handlers = new Map<DomainEventType, Set<EventHandler>>();

  subscribe<T>(type: DomainEventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  async publish<T>(type: DomainEventType, tenantId: string, payload: T): Promise<void> {
    const event: DomainEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      tenantId,
      payload,
      timestamp: new Date().toISOString(),
    };

    const listeners = this.handlers.get(type);
    if (listeners) {
      for (const handler of Array.from(listeners)) {
        try {
          await handler(event);
        } catch (err) {
          console.error(`[EventBus Error] Event handler failed for ${type}:`, err);
        }
      }
    }
  }
}

export const eventBus = new EventBusEngine();
