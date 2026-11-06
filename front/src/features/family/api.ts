import type { z } from 'zod';
import type { ApiClient } from '../../shared/api/client.js';
import type { contracts, Success } from '../../shared/api/contracts.generated.js';

export type FamilyTransport = Pick<ApiClient, 'request'>;
export type FamilyCreateCommand = z.input<(typeof contracts)['POST /api/v1/family']['request']>;
export type FamilyInvitationCreateCommand = z.input<(typeof contracts)['POST /api/v1/family/invitations']['request']>;
export type FamilyInvitationDecisionCommand = z.input<
    (typeof contracts)['POST /api/v1/family/invitations/{invitationId}/approve']['request']
>;
export type FamilyMemberRemoveCommand = z.input<
    (typeof contracts)['POST /api/v1/family/members/{membershipId}/remove']['request']
>;
export type FamilyLeaveCommand = z.input<(typeof contracts)['POST /api/v1/family/leave']['request']>;
export type FamilyInvitationAcceptCommand = z.input<
    (typeof contracts)['POST /api/v1/family/invitation-accept']['request']
>;
export type FamilyOwnershipPreviewCommand = z.input<
    (typeof contracts)['POST /api/v1/family/ownership/preview']['request']
>;
export type FamilyOwnershipRequestCommand = z.input<
    (typeof contracts)['POST /api/v1/family/ownership/requests']['request']
>;
export type FamilyOwnershipDecisionCommand = z.input<
    (typeof contracts)['POST /api/v1/family/ownership/requests/{token}/accept']['request']
>;
export type FamilyOwnershipNoticeDismissCommand = z.input<
    (typeof contracts)['POST /api/v1/family/ownership-notice/dismiss']['request']
>;

export async function loadFamilyContext(
    transport: FamilyTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/family'>['data']> {
    return (await transport.request('GET /api/v1/family', undefined, signal)).data;
}

export function createFamily(
    transport: FamilyTransport,
    command: FamilyCreateCommand,
): Promise<Success<'POST /api/v1/family'>> {
    return transport.request('POST /api/v1/family', command);
}

export async function loadFamilyInvitations(
    transport: FamilyTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/family/invitations'>['data']> {
    return (await transport.request('GET /api/v1/family/invitations', undefined, signal)).data;
}

export async function createFamilyInvitation(
    transport: FamilyTransport,
    command: FamilyInvitationCreateCommand,
): Promise<Success<'POST /api/v1/family/invitations'>['data']> {
    return (await transport.request('POST /api/v1/family/invitations', command)).data;
}

export async function decideFamilyInvitation(
    transport: FamilyTransport,
    action: 'approve' | 'cancel',
    invitationId: string,
    command: FamilyInvitationDecisionCommand,
): Promise<
    | Success<'POST /api/v1/family/invitations/{invitationId}/approve'>['data']
    | Success<'POST /api/v1/family/invitations/{invitationId}/cancel'>['data']
> {
    return action === 'approve'
        ? (
              await transport.request('POST /api/v1/family/invitations/{invitationId}/approve', command, undefined, {
                  invitationId,
              })
          ).data
        : (
              await transport.request('POST /api/v1/family/invitations/{invitationId}/cancel', command, undefined, {
                  invitationId,
              })
          ).data;
}

export async function removeFamilyMember(
    transport: FamilyTransport,
    membershipId: string,
    command: FamilyMemberRemoveCommand,
): Promise<Success<'POST /api/v1/family/members/{membershipId}/remove'>['data']> {
    return (
        await transport.request('POST /api/v1/family/members/{membershipId}/remove', command, undefined, {
            membershipId,
        })
    ).data;
}

export async function loadFamilyLeavePreview(
    transport: FamilyTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/family/leave-preview'>['data']> {
    return (await transport.request('GET /api/v1/family/leave-preview', undefined, signal)).data;
}

export async function leaveFamily(
    transport: FamilyTransport,
    command: FamilyLeaveCommand,
): Promise<Success<'POST /api/v1/family/leave'>['data']> {
    return (await transport.request('POST /api/v1/family/leave', command)).data;
}

export async function loadFamilyInvitationPreview(
    transport: FamilyTransport,
    token: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/family/invitation-preview'>['data']> {
    return (
        await transport.request('GET /api/v1/family/invitation-preview', undefined, signal, undefined, {
            query: { token },
        })
    ).data;
}

export async function acceptFamilyInvitation(
    transport: FamilyTransport,
    command: FamilyInvitationAcceptCommand,
): Promise<Success<'POST /api/v1/family/invitation-accept'>['data']> {
    return (await transport.request('POST /api/v1/family/invitation-accept', command)).data;
}

export async function loadFamilyOwnership(
    transport: FamilyTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/family/ownership'>['data']> {
    return (await transport.request('GET /api/v1/family/ownership', undefined, signal)).data;
}

export async function previewFamilyOwnership(
    transport: FamilyTransport,
    command: FamilyOwnershipPreviewCommand,
): Promise<Success<'POST /api/v1/family/ownership/preview'>['data']> {
    return (await transport.request('POST /api/v1/family/ownership/preview', command)).data;
}

export async function createFamilyOwnershipRequest(
    transport: FamilyTransport,
    command: FamilyOwnershipRequestCommand,
): Promise<Success<'POST /api/v1/family/ownership/requests'>['data']> {
    return (await transport.request('POST /api/v1/family/ownership/requests', command)).data;
}

export async function loadFamilyOwnershipRequest(
    transport: FamilyTransport,
    token: string,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/family/ownership/requests/{token}'>['data']> {
    return (await transport.request('GET /api/v1/family/ownership/requests/{token}', undefined, signal, { token }))
        .data;
}

export async function decideFamilyOwnershipRequest(
    transport: FamilyTransport,
    action: 'accept' | 'decline' | 'cancel',
    token: string,
    command: FamilyOwnershipDecisionCommand,
): Promise<
    | Success<'POST /api/v1/family/ownership/requests/{token}/accept'>['data']
    | Success<'POST /api/v1/family/ownership/requests/{token}/decline'>['data']
    | Success<'POST /api/v1/family/ownership/requests/{token}/cancel'>['data']
> {
    if (action === 'accept')
        return (
            await transport.request('POST /api/v1/family/ownership/requests/{token}/accept', command, undefined, {
                token,
            })
        ).data;
    if (action === 'decline')
        return (
            await transport.request('POST /api/v1/family/ownership/requests/{token}/decline', command, undefined, {
                token,
            })
        ).data;
    return (
        await transport.request('POST /api/v1/family/ownership/requests/{token}/cancel', command, undefined, { token })
    ).data;
}

export async function loadFamilyOwnershipNotice(
    transport: FamilyTransport,
    signal?: AbortSignal,
): Promise<Success<'GET /api/v1/family/ownership-notice'>['data']> {
    return (await transport.request('GET /api/v1/family/ownership-notice', undefined, signal)).data;
}

export async function dismissFamilyOwnershipNotice(
    transport: FamilyTransport,
    command: FamilyOwnershipNoticeDismissCommand,
): Promise<Success<'POST /api/v1/family/ownership-notice/dismiss'>['data']> {
    return (await transport.request('POST /api/v1/family/ownership-notice/dismiss', command)).data;
}
