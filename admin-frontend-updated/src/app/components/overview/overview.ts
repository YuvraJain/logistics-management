import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, OverviewStats } from '../../services/dashboard';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview.html',
  styleUrls: ['./overview.css']
})
export class OverviewComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  isLoading = signal(true);
  loadError = signal<string | null>(null);

  newUsersCount = signal(0);
  newDeliveriesCount = signal(0);
  totalCustomerBookings = signal(0);

  daywisePayments = signal<Array<{ day: string; amount: number }>>([]);
  daywiseBookings = signal<Array<{ day: string; count: number }>>([]);

  // Max calculations for graph scaling
  maxPaymentAmount = computed(() => {
    const vals = this.daywisePayments().map(p => p.amount);
    return vals.length > 0 ? Math.max(...vals, 1000) : 1000;
  });

  maxBookingCount = computed(() => {
    const vals = this.daywiseBookings().map(b => b.count);
    return vals.length > 0 ? Math.max(...vals, 5) : 5;
  });

  // Calculate SVG line/area path coordinates for Usage Rate
  usageLinePath = computed(() => {
    const bookings = this.daywiseBookings();
    if (bookings.length === 0) return '';
    const max = this.maxBookingCount();
    
    // Width: 600, Height: 200. Margins: left=40, right=20, top=20, bottom=40
    const w = 600;
    const h = 200;
    const paddingLeft = 50;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;
    
    const chartW = w - paddingLeft - paddingRight;
    const chartH = h - paddingTop - paddingBottom;
    
    const points = bookings.map((b, idx) => {
      const x = paddingLeft + (idx / (bookings.length - 1)) * chartW;
      const y = h - paddingBottom - (b.count / max) * chartH;
      return { x, y };
    });
    
    // Generate SVG path string
    return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  });

  usageAreaPath = computed(() => {
    const bookings = this.daywiseBookings();
    if (bookings.length === 0) return '';
    
    const w = 600;
    const h = 200;
    const paddingLeft = 50;
    const paddingRight = 30;
    const paddingBottom = 40;
    
    const linePath = this.usageLinePath();
    // Close the area path down to the x-axis
    const startX = paddingLeft;
    const endX = w - paddingRight;
    const baseY = h - paddingBottom;
    
    return `${linePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  });

  usageDots = computed(() => {
    const bookings = this.daywiseBookings();
    if (bookings.length === 0) return [];
    const max = this.maxBookingCount();
    
    const w = 600;
    const h = 200;
    const paddingLeft = 50;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;
    
    const chartW = w - paddingLeft - paddingRight;
    const chartH = h - paddingTop - paddingBottom;
    
    return bookings.map((b, idx) => {
      const x = paddingLeft + (idx / (bookings.length - 1)) * chartW;
      const y = h - paddingBottom - (b.count / max) * chartH;
      return { x, y, day: b.day, count: b.count };
    });
  });

  ngOnInit(): void {
    this.refreshStats();
  }

  refreshStats(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.dashboardService.getOverviewStats().subscribe({
      next: (data) => {
        this.newUsersCount.set(data.new_users_count);
        this.newDeliveriesCount.set(data.new_deliveries_count);
        this.totalCustomerBookings.set(data.total_customer_bookings);
        this.daywisePayments.set(data.daywise_payments);
        this.daywiseBookings.set(data.daywise_bookings);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load overview stats', err);
        this.loadError.set('Could not fetch overview metrics. Check connection or console.');
        this.isLoading.set(false);
      }
    });
  }

  getPaymentBarHeight(amount: number): number {
    const max = this.maxPaymentAmount();
    return Math.max(5, Math.round((amount / max) * 100));
  }
}
