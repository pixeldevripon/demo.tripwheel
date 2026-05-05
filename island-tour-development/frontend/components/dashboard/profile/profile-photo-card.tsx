'use client';

import { Camera, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function ProfilePhotoCard({ user }: { user: any }) {
    return (
        <Card className="border-none shadow-sm bg-card overflow-hidden rounded-2xl">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Camera className="w-5 h-5 text-primary" />
                    Profile Photo
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative group">
                        <Avatar className="w-32 h-32 border-4 border-background shadow-xl ring-1 ring-border group-hover:opacity-90 transition-all duration-300">
                            <AvatarImage src={user?.image || "https://github.com/shadcn.png"} />
                            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                                {user?.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <button className="absolute bottom-1 right-1 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-110 transition-transform duration-200 ring-2 ring-background">
                            <Upload className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 space-y-4 text-center md:text-left">
                        <div className="space-y-1">
                            <h3 className="font-medium text-foreground">Update your photo</h3>
                            <p className="text-sm text-muted-foreground">
                                Supported formats: JPG, PNG or WEBP. Max size 5MB.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                            <Button size="sm" variant="outline" className="rounded-lg h-9">
                                Upload New
                            </Button>
                            <Button size="sm" variant="ghost" className="rounded-lg h-9 text-destructive hover:text-destructive hover:bg-destructive/10">
                                Remove
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
