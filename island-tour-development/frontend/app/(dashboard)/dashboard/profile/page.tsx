import { ProfileClient } from '../../../../components/dashboard/profile/profile-client';

// This is a Server Component
export default async function ProfilePage() {
    // In a real app, you'd fetch user data here
    // const user = await getUser();

    const mockUser = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1 (555) 000-0000',
        dob: '1990-01-01',
        nationality: 'American',
        location: 'New York, USA',
        image: 'https://github.com/shadcn.png',
    };

    return <ProfileClient user={mockUser} />;
}

