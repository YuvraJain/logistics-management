import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DashboardStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  users_by_role: Record<string, number>;
}

export interface OverviewStats {
  new_users_count: number;
  new_deliveries_count: number;
  total_customer_bookings: number;
  new_users_list: any[];
  new_deliveries_list: any[];
  all_deliveries_list: any[];
  customer_summary: any[];
  daywise_payments: Array<{ day: string; amount: number }>;
  daywise_bookings: Array<{ day: string; count: number }>;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/api/dashboard/stats`);
  }

  getOverviewStats(): Observable<OverviewStats> {
    return this.http.get<OverviewStats>(`${this.apiUrl}/api/dashboard/overview`);
  }
}
