'use client';

import { FollowAuthorButton } from '../../entities/recommendation/client.js';
import { PublicProgressSummary } from '../../features/achievements/client.js';
import { FollowingList } from '../../features/community/client.js';
import {
    OwnProfilePage as OwnProfileFeaturePage,
    PublicProfilePage as PublicProfileFeaturePage,
} from '../../features/profiles/client.js';
import { PublicRecipeFeed } from '../../features/recipes/client.js';

export function OwnProfilePage() {
    return (
        <OwnProfileFeaturePage
            following={
                <FollowingList
                    renderFollowAction={(username) => <FollowAuthorButton key={username} username={username} />}
                />
            }
        />
    );
}

export function PublicProfilePage({ username }: { username: string }) {
    return (
        <PublicProfileFeaturePage
            username={username}
            followAction={<FollowAuthorButton username={username} />}
            progressSummary={<PublicProgressSummary username={username} />}
            recipeFeed={<PublicRecipeFeed author={username} returnTo={`/authors/${encodeURIComponent(username)}`} />}
        />
    );
}
