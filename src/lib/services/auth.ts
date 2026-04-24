import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { hash, compare } from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { hasPermission, type Permission } from "./permissions";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);
const JWT_EXPIRY = process.env.JWT_EXPIRY || "24h";
export const AUTH_COOKIE = "auth-token";
const BCRYPT_COST = 12;

export interface Session {
  userId: string;
  email: string;
  roles: UserRole[];
  name: string;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function signToken(payload: Session): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      roles: payload.roles as UserRole[],
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

export function getCookieOptions() {
  return {
    name: AUTH_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 86400,
  };
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Permission-based authorization. Checks a specific permission against the
 * union of the user's assigned roles. Throws AuthorizationError on denial.
 */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await requireAuth();
  if (!hasPermission(session.roles, permission)) {
    throw new AuthorizationError(
      `Roles [${session.roles.join(", ")}] no tienen permiso: ${permission}`
    );
  }
  return session;
}

/**
 * Synchronous permission check for use inside actions that already have a session.
 * Throws AuthorizationError on denial.
 */
export function requirePermissionSync(roles: UserRole[], permission: Permission): void {
  if (!hasPermission(roles, permission)) {
    throw new AuthorizationError(
      `Roles [${roles.join(", ")}] no tienen permiso: ${permission}`
    );
  }
}
