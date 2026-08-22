import { NextRequest, NextResponse } from 'next/server';

interface CalendarSlot {
  slot_id: string;
  start_time: string;
  end_time: string;
  display_time: string;
  is_available: boolean;
  status: 'open' | 'busy' | 'confirmed';
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const slots: CalendarSlot[] = [];
    const baseHour = 8;

    for (let i = 0; i < 18; i++) {
      const slotStart = new Date(now);
      slotStart.setHours(baseHour + Math.floor(i / 2), (i % 2) * 30, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotStart.getMinutes() + 30);

      // Deterministic busy blocks (e.g. 10:00 - 11:30 and 13:00 - 14:00)
      const hour = slotStart.getHours();
      const isBusy = (hour === 10) || (hour === 13);

      slots.push({
        slot_id: `slot-${i + 1}`,
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        display_time: slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        is_available: !isBusy,
        status: isBusy ? 'busy' : 'open',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        calendar_id: 'primary@google.calendar',
        synced_at: new Date().toISOString(),
        slots,
        congestion_load_factor: 0.45,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
