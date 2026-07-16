'use server';

export async function getDashboardStats() {
    // Mock data based on legacy structure
    return {
        result: {
            data: {
                revenue: {
                    totalRevenue: 125000.50,
                    thisMonth: 15420.75,
                    lastMonth: 12100.00,
                    netRevenue: 112000.00
                },
                bookings: {
                    total: 1240,
                    thisMonth: 145,
                    lastMonth: 132,
                    upcoming: 24,
                    byStatus: {
                        draft: 15,
                        confirmed: 85,
                        cancelled: 12,
                        completed: 128
                    }
                },
                trips: {
                    total: 42,
                    createdThisMonth: 5,
                    withBookings: 38,
                    byStatus: {
                        draft: 4,
                        published: 35,
                        archived: 3
                    }
                },
                customers: {
                    total: 856,
                    newThisMonth: 64,
                    newLastMonth: 52,
                    verified: 720,
                    withBookings: 640,
                    repeatCustomers: 125,
                    activeThisMonth: 320
                },
                recentActivity: {
                    recentBookings: [
                        {
                            id: '1',
                            createdAt: new Date().toISOString(),
                            status: 'confirmed',
                            bookingReference: 'BK-1234',
                            customer: { name: 'John Doe' },
                            trip: { title: 'Bali Adventure' }
                        },
                        {
                            id: '2',
                            createdAt: new Date(Date.now() - 86400000).toISOString(),
                            status: 'pending',
                            bookingReference: 'BK-1235',
                            customer: { name: 'Jane Smith' },
                            trip: { title: 'Maldives Paradise' }
                        }
                    ],
                    recentPayments: [
                        {
                            id: 'p1',
                            createdAt: new Date().toISOString(),
                            amount: 1500.00,
                            currency: 'USD',
                            status: 'completed',
                            paymentMethod: 'stripe',
                            booking: { bookingReference: 'BK-1234' }
                        }
                    ],
                    recentCustomers: [
                        {
                            id: 'c1',
                            name: 'Alice Brown',
                            email: 'alice@example.com',
                            createdAt: new Date().toISOString(),
                            isVerified: true
                        }
                    ]
                },
                payments: {
                    byStatus: {
                        completed: 1100,
                        pending: 45,
                        failed: 12,
                        refunded: 5
                    }
                },
                inquiries: {
                    total: 450,
                    pending: 24,
                    replied: 426
                },
                leads: {
                    total: 120
                }
            }
        }
    };
}
