import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function SignupFormSkeleton() {
    return (
        <Card className='w-full max-w-md mx-auto'>
            <CardHeader className="space-y-2">
                <CardTitle><Skeleton className="h-7 w-28" /></CardTitle>
                <CardDescription>
                    <Skeleton className="h-4 w-64" />
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>
            </CardContent>
            <CardFooter className='flex flex-col gap-4 mt-4'>
                <Skeleton className="h-10 w-full rounded-md" />
                
                <div className="relative w-full text-center text-sm flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                    </div>
                    <Skeleton className="relative z-10 h-4 w-28 bg-card px-2" />
                </div>
                
                <Skeleton className="h-10 w-full rounded-md" />
                
                <div className="flex justify-center mt-2">
                    <Skeleton className="h-4 w-48" />
                </div>
            </CardFooter>
        </Card>
    )
}
