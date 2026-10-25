import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role, SellerApplication, SellerApplicationStatus, SellerType, User, UserStatus } from '@prisma/client';
import { SellersRepository } from './sellers.repository';
import { SellersService } from './sellers.service';
import { notificationsService } from '../notifications/notifications.service';
import { mailProvider } from '../../providers/mail';
import { writeAuditLog } from '../../utils/auditLog';

vi.mock('../../providers/mail', () => ({
  mailProvider: { sendMail: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../utils/auditLog', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../notifications/notifications.service', () => ({
  notificationsService: {
    notifySellerApplicationApproved: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../auth/auth.service', () => ({
  authService: {
    createPasswordSetupUrl: vi
      .fn()
      .mockResolvedValue('http://localhost:3000/reset-password?id=prt-1&token=secret&welcome=1'),
  },
}));

function buildApplication(overrides: Partial<SellerApplication> = {}): SellerApplication {
  return {
    id: 'app-1',
    businessName: 'Jaipur Handicrafts',
    contactName: 'Asha Sharma',
    email: 'asha@jaipurhandicrafts.example',
    phone: '+911234567890',
    businessAddress: 'Jaipur, Rajasthan',
    message: null,
    status: SellerApplicationStatus.PENDING,
    rejectionReason: null,
    internalNotes: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    city: 'Jaipur',
    country: 'India',
    instagramHandle: 'jaipurhandicrafts',
    instagramFollowers: 1000,
    websiteOrSocialLink: null,
    craftCategories: [],
    productDescription: null,
    giTaggedProducts: null,
    monthlySalesVolume: null,
    shippedInternationally: null,
    approxExportOrders: null,
    exportCountries: null,
    sellingOnAmazon: null,
    otherPlatforms: [],
    gstRegistration: null,
    companyIncorporation: null,
    iecStatus: null,
    businessType: 'Manufacturer',
    hearAboutUs: null,
    agreedToCommissionTerms: true,
    sellerType: SellerType.CURATED,
    isFavourite: false,
    favouritedById: null,
    favouritedAt: null,
    brandName: null,
    brandLogoUrl: null,
    brandBannerUrl: null,
    brandStory: null,
    brandWebsite: null,
    minOrderValueInr: null,
    commissionTermsVersion: null,
    commissionAgreedAt: null,
    ...overrides,
  };
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'asha@jaipurhandicrafts.example',
    passwordHash: 'hash',
    role: Role.SELLER,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date(),
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMockRepo(): SellersRepository {
  return {
    createApplication: vi.fn(),
    findApplicationById: vi.fn(),
    findLatestApplicationByEmail: vi.fn(),
    findApplications: vi.fn(),
    findApplicationsForExport: vi.fn(),
    setApplicationFavourite: vi.fn(),
    updateApplication: vi.fn(),
    findUserByEmail: vi.fn(),
    createSellerUserAndProfile: vi.fn(),
    findSellerProfileByUserId: vi.fn(),
    findSellerProfileById: vi.fn(),
    updateSellerProfile: vi.fn(),
    findSellers: vi.fn(),
    findSellerWithUserById: vi.fn(),
    findSellerProfileWithBrandByUserId: vi.fn(),
    findPlatformSettingValue: vi.fn(),
    upsertPlatformSetting: vi.fn(),
    createHouseSellerUserAndProfile: vi.fn(),
  } as unknown as SellersRepository;
}

describe('SellersService', () => {
  let repo: SellersRepository;
  let service: SellersService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = buildMockRepo();
    service = new SellersService(repo);
  });

  describe('submitApplication', () => {
    it('rejects when an account already exists for the email', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(buildUser());

      await expect(
        service.submitApplication({
          businessName: 'X',
          contactName: 'Y',
          email: 'asha@jaipurhandicrafts.example',
          phone: '123',
          city: 'Jaipur',
          country: 'India',
          instagramHandle: 'x',
          instagramFollowers: 100,
          businessType: 'Manufacturer',
          agreedToCommissionTerms: true,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(repo.createApplication).not.toHaveBeenCalled();
    });

    it('rejects a duplicate application while one is still under review', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.findLatestApplicationByEmail).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.MORE_INFO_REQUESTED }),
      );

      await expect(
        service.submitApplication({
          businessName: 'X',
          contactName: 'Y',
          email: 'asha@jaipurhandicrafts.example',
          phone: '123',
          city: 'Jaipur',
          country: 'India',
          instagramHandle: 'x',
          instagramFollowers: 100,
          businessType: 'Manufacturer',
          agreedToCommissionTerms: true,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('allows a fresh application if the previous one was rejected', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.findLatestApplicationByEmail).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.REJECTED }),
      );
      vi.mocked(repo.createApplication).mockResolvedValue(buildApplication());

      await service.submitApplication({
        businessName: 'X',
        contactName: 'Y',
        email: 'asha@jaipurhandicrafts.example',
        phone: '123',
        city: 'Jaipur',
        country: 'India',
        instagramHandle: 'x',
        instagramFollowers: 100,
        businessType: 'Manufacturer',
        agreedToCommissionTerms: true,
      });

      expect(repo.createApplication).toHaveBeenCalledTimes(1);
      expect(repo.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({ businessAddress: 'Jaipur, India' }),
      );
    });
  });

  describe('approveApplication', () => {
    it('rejects approving an application that was already rejected', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.REJECTED }),
      );

      await expect(service.approveApplication('app-1', 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(repo.createSellerUserAndProfile).not.toHaveBeenCalled();
    });

    it('rejects approving if an account was created for this email in the meantime', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(buildApplication());
      vi.mocked(repo.findUserByEmail).mockResolvedValue(buildUser());

      await expect(service.approveApplication('app-1', 'admin-1')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('creates the SELLER account and marks the application approved', async () => {
      const application = buildApplication();
      vi.mocked(repo.findApplicationById).mockResolvedValue(application);
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.createSellerUserAndProfile).mockResolvedValue({
        user: buildUser(),
        profile: {
          id: 'profile-1',
          userId: 'user-1',
          applicationId: 'app-1',
          businessName: application.businessName,
          contactName: application.contactName,
          phone: application.phone,
          businessAddress: application.businessAddress,
          bankDetails: null,
          notificationPrefs: null,
          isOnVacation: false,
          internalRating: null,
          internalNotes: null,
          whatsappNumber: null,
          whatsappVerifiedAt: null,
    whatsappOptedOutAt: null,
          sellerType: SellerType.CURATED,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      });

      const result = await service.approveApplication('app-1', 'admin-1');

      expect(repo.updateApplication).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({ status: SellerApplicationStatus.APPROVED, reviewedById: 'admin-1' }),
      );
      expect(result.user.role).toBe(Role.SELLER);

      const mail = vi.mocked(mailProvider.sendMail).mock.calls.at(-1)![0];
      expect(mail.html).toContain('Set your password and sign in');
      expect(mail.html).toContain('reset-password?id=prt-1&amp;token=secret&amp;welcome=1');
      expect(mail.html).toContain('Temporary password');
      // The temporary password must never be part of any link.
      const hrefs = [...mail.html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
      expect(hrefs.length).toBeGreaterThan(0);
      const tempPassword = /Temporary password: <strong>([^<]+)<\/strong>/.exec(mail.html)![1];
      for (const href of hrefs) expect(href).not.toContain(tempPassword);
    });
  });

  describe('rejectApplication / requestMoreInfo on closed applications', () => {
    it('rejects rejecting an application that is already approved', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.APPROVED }),
      );

      await expect(service.rejectApplication('app-1', 'not a fit', 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('allows requesting more info on a pending application', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(buildApplication());
      vi.mocked(repo.updateApplication).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.MORE_INFO_REQUESTED }),
      );

      const result = await service.requestMoreInfo('app-1', 'Please share GST certificate', 'admin-1');

      expect(result.status).toBe(SellerApplicationStatus.MORE_INFO_REQUESTED);
      expect(repo.updateApplication).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({ status: SellerApplicationStatus.MORE_INFO_REQUESTED }),
      );
    });
  });

  describe('addInternalNote', () => {
    it('appends a timestamped note to any existing internal notes', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(
        buildApplication({ internalNotes: 'earlier note' }),
      );
      vi.mocked(repo.updateApplication).mockResolvedValue(buildApplication());

      await service.addInternalNote('app-1', 'called applicant, awaiting reply');

      const call = vi.mocked(repo.updateApplication).mock.calls[0][1];
      expect(call.internalNotes).toContain('earlier note');
      expect(call.internalNotes).toContain('called applicant, awaiting reply');
    });
  });

  describe('listSellers / getSellerDetailForAdmin', () => {
    const sellerWithUser = () => ({
      id: 'profile-1',
      userId: 'user-1',
      applicationId: null,
      businessName: 'Jaipur Handicrafts',
      contactName: 'Asha Sharma',
      phone: '123',
      businessAddress: 'Jaipur',
      bankDetails: null,
      notificationPrefs: null,
      isOnVacation: false,
      internalRating: null,
      internalNotes: null,
      sellerType: SellerType.CURATED,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      user: {
        id: 'user-1',
        email: 'asha@example.com',
        passwordHash: 'super-secret-hash',
        role: 'SELLER',
        status: 'ACTIVE',
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    it('listSellers never leaks passwordHash via the nested user object', async () => {
      vi.mocked(repo.findSellers).mockResolvedValue({ data: [sellerWithUser()], total: 1 } as never);

      const { data } = await service.listSellers({ page: 1, limit: 20 });

      expect(data[0].user).not.toHaveProperty('passwordHash');
    });

    it('getSellerDetailForAdmin throws 404 for a seller that does not exist', async () => {
      vi.mocked(repo.findSellerWithUserById).mockResolvedValue(null);

      await expect(service.getSellerDetailForAdmin('missing')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('getSellerDetailForAdmin never leaks passwordHash', async () => {
      vi.mocked(repo.findSellerWithUserById).mockResolvedValue(sellerWithUser() as never);

      const result = await service.getSellerDetailForAdmin('profile-1');

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('own profile', () => {
    it('getMyProfile throws 404 when no seller profile exists for the user', async () => {
      vi.mocked(repo.findSellerProfileByUserId).mockResolvedValue(null);

      await expect(service.getMyProfile('user-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('updateMyProfile resolves the profile then updates it', async () => {
      vi.mocked(repo.findSellerProfileByUserId).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        applicationId: null,
        businessName: 'Jaipur Handicrafts',
        contactName: 'Asha Sharma',
        phone: '123',
        businessAddress: 'Jaipur',
        bankDetails: null,
        notificationPrefs: null,
        isOnVacation: false,
        internalRating: null,
        internalNotes: null,
        whatsappNumber: null,
        whatsappVerifiedAt: null,
    whatsappOptedOutAt: null,
        sellerType: SellerType.CURATED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      vi.mocked(repo.updateSellerProfile).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        applicationId: null,
        businessName: 'Jaipur Handicrafts',
        contactName: 'Asha Sharma',
        phone: '123',
        businessAddress: 'Jaipur',
        bankDetails: 'HDFC Bank',
        notificationPrefs: null,
        isOnVacation: false,
        internalRating: null,
        internalNotes: null,
        whatsappNumber: null,
        whatsappVerifiedAt: null,
    whatsappOptedOutAt: null,
        sellerType: SellerType.CURATED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result = await service.updateMyProfile('user-1', { bankDetails: 'HDFC Bank' });

      expect(repo.updateSellerProfile).toHaveBeenCalledWith('profile-1', { bankDetails: 'HDFC Bank' });
      expect(result.bankDetails).toBe('HDFC Bank');
    });
  });

  describe('listApplications / getApplicationDetail', () => {
    it('listApplications passes the filter and pagination through to the repository', async () => {
      vi.mocked(repo.findApplications).mockResolvedValue({ data: [], total: 0 });

      await service.listApplications({ status: SellerApplicationStatus.PENDING }, { page: 1, limit: 20 });

      expect(repo.findApplications).toHaveBeenCalledWith(
        { status: SellerApplicationStatus.PENDING },
        { page: 1, limit: 20 },
      );
    });

    it('listApplications passes the favourite filter through', async () => {
      vi.mocked(repo.findApplications).mockResolvedValue({ data: [], total: 0 });

      await service.listApplications({ favourite: true }, { page: 1, limit: 20 });

      expect(repo.findApplications).toHaveBeenCalledWith({ favourite: true }, { page: 1, limit: 20 });
    });

    it('setApplicationFavourite stars an application, and unstarring clears who starred it', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(buildApplication());
      vi.mocked(repo.setApplicationFavourite).mockResolvedValue(buildApplication({ isFavourite: true }));

      await service.setApplicationFavourite('app-1', true, 'admin-1');
      expect(repo.setApplicationFavourite).toHaveBeenCalledWith('app-1', true, 'admin-1');

      await service.setApplicationFavourite('app-1', false, 'admin-1');
      expect(repo.setApplicationFavourite).toHaveBeenLastCalledWith('app-1', false, 'admin-1');
    });

    it('setApplicationFavourite throws 404 for an application that does not exist', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(null);

      await expect(service.setApplicationFavourite('missing', true, 'admin-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('getApplicationDetail throws 404 for an application that does not exist', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(null);

      await expect(service.getApplicationDetail('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('exportApplicationsCsv', () => {
    it('passes the screen filters straight through, unpaginated and capped', async () => {
      vi.mocked(repo.findApplicationsForExport).mockResolvedValue([]);

      await service.exportApplicationsCsv(
        { status: SellerApplicationStatus.PENDING, search: 'jaipur', favourite: true },
        'admin-1',
      );

      expect(repo.findApplicationsForExport).toHaveBeenCalledWith(
        { status: SellerApplicationStatus.PENDING, search: 'jaipur', favourite: true },
        SellersService.EXPORT_ROW_CAP,
      );
    });

    it('names the file with today’s date', async () => {
      vi.mocked(repo.findApplicationsForExport).mockResolvedValue([]);

      const { filename } = await service.exportApplicationsCsv({}, 'admin-1');

      expect(filename).toMatch(/^seller-applications-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('writes a BOM, the header row and one row per application', async () => {
      vi.mocked(repo.findApplicationsForExport).mockResolvedValue([
        buildApplication({ createdAt: new Date('2026-02-03T00:00:00Z') }),
        buildApplication({ id: 'app-2', businessName: 'Kutch Weavers' }),
      ]);

      const { csv, rows, truncated } = await service.exportApplicationsCsv({}, 'admin-1');

      expect(csv.startsWith('﻿')).toBe(true);
      const lines = csv.trimEnd().split('\r\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain('Business name');
      expect(lines[0]).toContain('Rejection reason');
      expect(lines[1]).toContain('Jaipur Handicrafts');
      expect(lines[1]).toContain('2026-02-03');
      expect(lines[2]).toContain('Kutch Weavers');
      expect(rows).toBe(2);
      expect(truncated).toBe(false);
    });

    it('renders the favourite flag as Yes/No and semicolon-joins craft categories', async () => {
      vi.mocked(repo.findApplicationsForExport).mockResolvedValue([
        buildApplication({ isFavourite: true, craftCategories: ['Textiles', 'Pottery'] }),
      ]);

      const { csv } = await service.exportApplicationsCsv({}, 'admin-1');

      expect(csv).toContain('Yes');
      expect(csv).toContain('Textiles; Pottery');
    });

    it('escapes a multi-line internal note instead of breaking the row grid', async () => {
      vi.mocked(repo.findApplicationsForExport).mockResolvedValue([
        buildApplication({ internalNotes: 'called them\nno answer, retry' }),
      ]);

      const { csv } = await service.exportApplicationsCsv({}, 'admin-1');

      expect(csv).toContain('"called them\nno answer, retry"');
    });

    it('neutralises a formula smuggled into an applicant field', async () => {
      vi.mocked(repo.findApplicationsForExport).mockResolvedValue([
        buildApplication({ businessName: '=cmd|\' /c calc\'!A1' }),
      ]);

      const { csv } = await service.exportApplicationsCsv({}, 'admin-1');

      expect(csv).not.toContain(',=cmd');
      expect(csv).toContain("'=cmd");
    });

    it('reports truncation and audit-logs the export without leaking row contents', async () => {
      vi.mocked(repo.findApplicationsForExport).mockResolvedValue(
        Array.from({ length: SellersService.EXPORT_ROW_CAP }, () => buildApplication()),
      );

      const { truncated } = await service.exportApplicationsCsv({ search: 'a' }, 'admin-1');

      expect(truncated).toBe(true);
      expect(writeAuditLog).toHaveBeenCalledWith(
        'admin-1',
        'SELLER_APPLICATIONS_EXPORTED',
        'SellerApplication',
        'export',
        expect.objectContaining({
          rows: SellersService.EXPORT_ROW_CAP,
          truncated: true,
          filter: { status: null, search: 'a', favourite: null },
        }),
      );
    });
  });

  describe('getOrCreateHouseSellerProfile', () => {
    it('returns the cached id without creating anything when already provisioned', async () => {
      vi.mocked(repo.findPlatformSettingValue).mockResolvedValue({ sellerId: 'house-profile-1' });

      const id = await service.getOrCreateHouseSellerProfile();

      expect(id).toBe('house-profile-1');
      expect(repo.createHouseSellerUserAndProfile).not.toHaveBeenCalled();
    });

    it('provisions the house seller once and caches its id when not yet created', async () => {
      vi.mocked(repo.findPlatformSettingValue).mockResolvedValue(null);
      vi.mocked(repo.createHouseSellerUserAndProfile).mockResolvedValue({
        user: buildUser({ id: 'house-user-1', email: 'house@solomonbharat.internal' }),
        profile: {
          id: 'house-profile-1',
          userId: 'house-user-1',
          applicationId: null,
          businessName: 'Solomon Bharat',
          contactName: 'Solomon Bharat',
          phone: 'N/A',
          businessAddress: 'N/A',
          bankDetails: null,
          notificationPrefs: null,
          isOnVacation: false,
          internalRating: null,
          internalNotes: null,
          whatsappNumber: null,
          whatsappVerifiedAt: null,
    whatsappOptedOutAt: null,
          sellerType: SellerType.CURATED,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      });

      const id = await service.getOrCreateHouseSellerProfile();

      expect(id).toBe('house-profile-1');
      expect(repo.createHouseSellerUserAndProfile).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'house@solomonbharat.internal', businessName: 'Solomon Bharat' }),
      );
      expect(repo.upsertPlatformSetting).toHaveBeenCalledWith('house_seller_profile_id', {
        sellerId: 'house-profile-1',
      });
    });
  });

  describe('applications are always curated', () => {
    const baseInput = {
      businessName: 'Kala Kendra Pvt Ltd',
      contactName: 'Meera',
      email: 'meera@kalakendra.in',
      phone: '123',
      city: 'Jaipur',
      country: 'India',
      businessType: 'Manufacturer',
      agreedToCommissionTerms: true,
      instagramHandle: 'x',
      instagramFollowers: 1,
    };

    it('stamps commissionAgreedAt when the Seller Agreement version is sent', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.findLatestApplicationByEmail).mockResolvedValue(null);
      vi.mocked(repo.createApplication).mockResolvedValue(buildApplication());

      await service.submitApplication({ ...baseInput, commissionTermsVersion: 'seller-2026-10' });

      expect(repo.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({ commissionTermsVersion: 'seller-2026-10', commissionAgreedAt: expect.any(Date) }),
      );
    });

    it('leaves commissionAgreedAt unset without an agreement version', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.findLatestApplicationByEmail).mockResolvedValue(null);
      vi.mocked(repo.createApplication).mockResolvedValue(buildApplication());

      await service.submitApplication(baseInput);

      expect(vi.mocked(repo.createApplication).mock.calls[0][0].commissionAgreedAt).toBeUndefined();
    });

    it('approval creates a curated seller and sends the seller notification + email', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(buildApplication({ sellerType: SellerType.MARKETPLACE }));
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.createSellerUserAndProfile).mockResolvedValue({ user: buildUser(), profile: {} as never });

      await service.approveApplication('app-1', 'admin-1');

      expect(vi.mocked(repo.createSellerUserAndProfile).mock.calls[0]).toHaveLength(2);
      expect(notificationsService.notifySellerApplicationApproved).toHaveBeenCalledWith('user-1');
      expect(mailProvider.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Your Solomon Bharat seller account is ready' }),
      );
    });
  });
});
