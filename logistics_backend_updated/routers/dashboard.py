"""
routers/dashboard.py - Dashboard statistics endpoint
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from auth import get_current_user, require_role
from database import User, Role, Delivery, get_db

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

# Statuses that count as "active" (i.e. not yet finished/cancelled)
ACTIVE_DELIVERY_STATUSES = ["Created", "Pending", "Unassigned", "Assigned", "Picked Up", "In Transit"]

AGENT_ROLE_ID = 2  # roles.id where name = 'agent' (matches routers/users.py)


@router.get("/stats")
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return aggregate user statistics. Accessible to any authenticated user."""
    total_users   = db.query(User).count()
    active_users  = db.query(User).filter(User.status == "Active").count()
    inactive_users = db.query(User).filter(User.status == "Inactive").count()

    # Count users per role name
    rows = (
        db.query(Role.name, func.count(User.id))
        .join(User, User.role_id == Role.id, isouter=True)
        .group_by(Role.name)
        .all()
    )
    users_by_role = {name: count for name, count in rows if name}

    return {
        "total_users":   total_users,
        "active_users":  active_users,
        "inactive_users": inactive_users,
        "users_by_role": users_by_role,
    }


@router.get("/dispatcher-stats", dependencies=[Depends(require_role("Admin", "Dispatcher"))])
def get_dispatcher_stats(db: Session = Depends(get_db)):
    """Return aggregate delivery + agent statistics for the dispatcher dashboard."""
    total_deliveries  = db.query(Delivery).count()
    active_deliveries = (
        db.query(Delivery).filter(Delivery.status.in_(ACTIVE_DELIVERY_STATUSES)).count()
    )

    total_agents = db.query(User).filter(User.role_id == AGENT_ROLE_ID).count()
    active_agents = (
        db.query(User)
        .filter(User.role_id == AGENT_ROLE_ID, User.status == "Active")
        .count()
    )

    return {
        "total_deliveries":  total_deliveries,
        "active_deliveries": active_deliveries,
        "total_agents":      total_agents,
        "active_agents":     active_agents,
    }

from datetime import datetime, timedelta, timezone

@router.get("/overview", dependencies=[Depends(require_role("Admin"))])
def get_overview_stats(db: Session = Depends(get_db)):
    """Return live financial and usage overview for Admin dashboard."""
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    # 1. New users created in the last 7 days
    new_users = db.query(User).filter(User.created_at >= seven_days_ago).all()
    new_users_list = [
        {
            "id": u.id,
            "fullname": u.fullname,
            "username": u.username,
            "email": u.email,
            "phone_number": u.phone_number,
            "city": u.city,
            "created_at": u.created_at.isoformat() if u.created_at else None
        } for u in new_users
    ]

    # 2. New deliveries in the last 7 days
    new_deliveries = db.query(Delivery).filter(Delivery.created_at >= seven_days_ago).all()
    new_deliveries_list = [
        {
            "id": d.id,
            "delivery_id": d.delivery_id,
            "customer_name": d.customer_name,
            "customer_phone": d.customer_phone,
            "sender_name": d.sender_name,
            "recipient_name": d.recipient_name,
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None
        } for d in new_deliveries
    ]

    # 3. How many times the customer used the system (total deliveries count)
    all_deliveries = db.query(Delivery).all()
    all_deliveries_list = [
        {
            "id": d.id,
            "delivery_id": d.delivery_id,
            "customer_name": d.customer_name,
            "customer_phone": d.customer_phone,
            "sender_name": d.sender_name,
            "recipient_name": d.recipient_name,
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None
        } for d in all_deliveries
    ]

    # 4. Group by customer to calculate total bookings and payments
    customer_summary = {}
    for d in all_deliveries:
        cust = d.customer_name or d.sender_name or "Unknown Customer"
        if cust not in customer_summary:
            customer_summary[cust] = {
                "name": cust,
                "bookings_count": 0,
                "total_payment": 0.0
            }
        customer_summary[cust]["bookings_count"] += 1
        
        # Calculate payment collected
        payment_amount = 0.0
        if d.payment_method == "COD":
            payment_amount += (d.cod_amount or 0.0)
        if d.payment_responsibility == "Receiver":
            payment_amount += (d.delivery_charge or 0.0)
        customer_summary[cust]["total_payment"] += payment_amount

    customer_summary_list = sorted(customer_summary.values(), key=lambda x: x["bookings_count"], reverse=True)

    # Initialize daywise dicts for the last 7 days (from 6 days ago until today)
    daywise_payments = {}
    daywise_bookings = {}

    for i in range(7):
        day_dt = now - timedelta(days=i)
        day_name = day_dt.strftime("%a") # e.g. "Mon"
        daywise_payments[day_name] = 0.0
        daywise_bookings[day_name] = 0

    for d in new_deliveries:
        if d.created_at:
            day_name = d.created_at.strftime("%a")
            if day_name in daywise_bookings:
                daywise_bookings[day_name] += 1
                
                # Calculate actual payment collected (COD amount + delivery charge if Receiver Pays)
                payment_amount = 0.0
                if d.payment_method == "COD":
                    payment_amount += (d.cod_amount or 0.0)
                if d.payment_responsibility == "Receiver":
                    payment_amount += (d.delivery_charge or 0.0)
                
                daywise_payments[day_name] += payment_amount

    # Convert to list ordered from oldest day to today
    ordered_days = []
    for i in reversed(range(7)):
        day_dt = now - timedelta(days=i)
        ordered_days.append(day_dt.strftime("%a"))

    daywise_payments_list = [{"day": day, "amount": daywise_payments.get(day, 0.0)} for day in ordered_days]
    daywise_bookings_list = [{"day": day, "count": daywise_bookings.get(day, 0)} for day in ordered_days]

    return {
        "new_users_count": len(new_users_list),
        "new_deliveries_count": len(new_deliveries_list),
        "total_customer_bookings": len(all_deliveries_list),
        "new_users_list": new_users_list,
        "new_deliveries_list": new_deliveries_list,
        "all_deliveries_list": all_deliveries_list,
        "customer_summary": customer_summary_list,
        "daywise_payments": daywise_payments_list,
        "daywise_bookings": daywise_bookings_list
    }

