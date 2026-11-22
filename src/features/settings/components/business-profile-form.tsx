"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import {
  ChevronLeft,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Image as ImageIcon,
  Palette,
  Check,
  Copy,
} from "lucide-react";
import type { Business } from "@/domain/business";
import type { SettingsDictionary } from "@/domain/i18n";
import { SoonItem } from "@/components/feedback";
import { ActionBar, Button, Field, Input, Textarea, useToast } from "@/components/ui";
import { updateBusinessProfileAction } from "../actions";
import { buildStorefrontUrl } from "../storefront-url";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { useManagerLocale } from "@/components/i18n";

const noopSubscribe = () => () => {};

export interface BusinessProfileFormProps {
  business: Business;
  dict: SettingsDictionary;
  /** Set for members who are not the owner: the slug (public address) is locked with this explanation. */
  slugLockedReason?: string;
}

export function BusinessProfileForm({
  business,
  dict,
  slugLockedReason,
}: BusinessProfileFormProps) {
  const { showToast, showError } = useToast();
  const { locale: managerLocale, dict: managerDict } = useManagerLocale();
  const x = managerDict.settingsExtra;
  type SaveResult = Awaited<ReturnType<typeof updateBusinessProfileAction>> | null;
  const [dismissed, setDismissed] = useState<SaveResult>(null);

  // Form states
  const [name, setName] = useState(business.name || "");
  const [slug, setSlug] = useState(business.slug || "");
  const [description, setDescription] = useState(business.description || "");
  const [phone, setPhone] = useState(business.phone || "");
  const [email, setEmail] = useState(business.email || "");
  const [whatsappNumber, setWhatsappNumber] = useState(business.whatsappNumber || "");
  const [address, setAddress] = useState(business.address || "");
  const [latitude, setLatitude] = useState(
    business.latitude !== undefined && business.latitude !== null ? String(business.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    business.longitude !== undefined && business.longitude !== null
      ? String(business.longitude)
      : "",
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(business.logoUrl || null);

  const [socialLinks, setSocialLinks] = useState({
    instagramUrl: business.instagramUrl || "",
    facebookUrl: business.facebookUrl || "",
    tiktokUrl: business.tiktokUrl || "",
  });

  // Field errors
  const [copied, setCopied] = useState(false);

  // Reset to original values
  const handleDiscard = () => {
    setName(business.name || "");
    setSlug(business.slug || "");
    setDescription(business.description || "");
    setPhone(business.phone || "");
    setEmail(business.email || "");
    setWhatsappNumber(business.whatsappNumber || "");
    setAddress(business.address || "");
    setLatitude(
      business.latitude !== undefined && business.latitude !== null
        ? String(business.latitude)
        : "",
    );
    setLongitude(
      business.longitude !== undefined && business.longitude !== null
        ? String(business.longitude)
        : "",
    );
    setLogoUrl(business.logoUrl || null);
    setSocialLinks({
      instagramUrl: business.instagramUrl || "",
      facebookUrl: business.facebookUrl || "",
      tiktokUrl: business.tiktokUrl || "",
    });
    setDismissed(result);
    showToast(x.discarded);
  };

  const clientOrigin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const storefrontUrl = buildStorefrontUrl({
    locale: managerLocale,
    fallbackOrigin: clientOrigin,
  });

  const handleCopyUrl = async () => {
    if (!storefrontUrl) return;
    try {
      await navigator.clipboard.writeText(storefrontUrl.fullUrl);
      setCopied(true);
      showToast(x.urlCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(storefrontUrl.fullUrl);
    }
  };

  const [result, formAction, isPending] = useActionState(async (): Promise<SaveResult> => {
    const parsedLatitude = latitude.trim() === "" ? null : Number(latitude);
    const parsedLongitude = longitude.trim() === "" ? null : Number(longitude);
    const res = await updateBusinessProfileAction({
      name,
      slug: slug.toLowerCase().trim(),
      description,
      phone,
      email: email || undefined,
      whatsappNumber,
      ...socialLinks,
      address,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      logoUrl,
    });

    if (res.ok) {
      showToast(dict.business.saveSuccess);
    } else {
      showError(actionErrorMessage(res, managerLocale));
    }
    return res;
  }, null);
  const errors: Record<string, string[]> =
    result && result !== dismissed && !result.ok ? (result.fieldErrors ?? {}) : {};

  const storeInitial = name ? name[0].toUpperCase() : "B";

  return (
    <form
      action={formAction}
      className="mx-auto w-full max-w-md px-4 py-6 pb-32"
      data-testid="business-profile-form"
    >
      {/* Top Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/manage/settings"
          data-testid="back-to-settings"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>{dict.title}</span>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-title-lg text-foreground">{dict.business.title}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.business.description}</p>
      </div>

      {/* Section 1: Storefront Identity */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.business.identitySection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-2xs">
          {/* Logo: shown when set; uploading is not built yet */}
          {/* TODO(settings): wire logo upload to Storage (no issue yet; log one via issue-logger) */}
          <div className="flex items-center gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={name}
                className="border-border h-16 w-16 shrink-0 rounded-full border object-cover"
              />
            ) : (
              <div className="bg-primary-soft text-primary-soft-foreground flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold">
                {storeInitial}
              </div>
            )}
            <SoonItem
              featureKey="business.logo"
              description={x.logoHint}
              className="border-border min-w-0 flex-1 rounded-xl border"
              data-testid="soon-business-logo"
            />
          </div>

          {/* Business Name */}
          <Field id="biz-name" label={dict.business.nameLabel} required error={errors.name?.[0]}>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={dict.business.namePlaceholder}
              className="rounded-xl px-3.5 py-2.5"
              data-testid="input-business-name"
            />
          </Field>

          {/* Description */}
          <Field id="biz-desc" label={dict.business.descLabel} hint={`${description.length}/500`}>
            <Textarea
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={dict.business.descPlaceholder}
              className="min-h-0 rounded-xl px-3.5 py-2.5"
              data-testid="input-business-description"
            />
          </Field>

          {/* Storefront URL Slug */}
          <Field id="biz-slug" label={dict.business.slugLabel} required error={errors.slug?.[0]}>
            {(control) => (
              <>
                <Input
                  {...control}
                  aria-describedby={
                    [control["aria-describedby"], slugLockedReason ? "biz-slug-locked" : null]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  disabled={Boolean(slugLockedReason)}
                  placeholder={x.slugPlaceholder}
                  className="rounded-xl px-3.5 py-2.5 font-mono disabled:opacity-60"
                  data-testid="input-business-slug"
                />
                {slugLockedReason && (
                  <p
                    id="biz-slug-locked"
                    className="text-muted-foreground mt-1.5 text-xs"
                    data-testid="slug-owner-only-notice"
                  >
                    {slugLockedReason}
                  </p>
                )}
              </>
            )}
          </Field>

          {/* Storefront Link */}
          <div
            className="border-border bg-muted/40 flex items-center justify-between gap-2 rounded-xl border px-3.5 py-1.5"
            data-testid="storefront-link-row"
          >
            <span
              className="text-muted-foreground min-h-5 min-w-0 flex-1 truncate font-mono text-sm leading-5"
              data-testid="storefront-url-preview"
            >
              {storefrontUrl?.displayUrl}
            </span>
            <Button
              variant="unstyled"
              size="none"
              type="button"
              onClick={handleCopyUrl}
              disabled={!storefrontUrl}
              aria-label={x.copyUrl}
              data-testid="button-copy-storefront-url"
              className="text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              {copied ? <Check className="text-primary h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Section 2: Contact Information */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.business.contactSection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-2xs">
          {/* Phone */}
          <Field id="biz-phone" label={dict.business.phoneLabel}>
            {(control) => (
              <div className="relative">
                <Phone className="text-muted-foreground pointer-events-none absolute top-3.5 left-3.5 h-5 w-5" />
                <Input
                  {...control}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 39 98 00 01"
                  data-testid="input-business-phone"
                  className="rounded-xl py-2.5 pr-3.5 pl-11"
                />
              </div>
            )}
          </Field>

          {/* Email */}
          <Field id="biz-email" label={dict.business.emailLabel} error={errors.email?.[0]}>
            {(control) => (
              <div className="relative">
                <Mail className="text-muted-foreground pointer-events-none absolute top-3.5 left-3.5 h-5 w-5" />
                <Input
                  {...control}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={x.emailPlaceholder}
                  data-testid="input-business-email"
                  className="rounded-xl py-2.5 pr-3.5 pl-11"
                />
              </div>
            )}
          </Field>

          {/* WhatsApp */}
          <Field id="biz-whatsapp" label={dict.business.whatsappLabel}>
            {(control) => (
              <div className="relative">
                <MessageCircle className="text-muted-foreground pointer-events-none absolute top-3.5 left-3.5 h-5 w-5" />
                <Input
                  {...control}
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+33 6 39 98 00 01"
                  data-testid="input-business-whatsapp"
                  className="rounded-xl py-2.5 pr-3.5 pl-11"
                />
              </div>
            )}
          </Field>

          {/* Physical Address */}
          <Field id="biz-address" label={dict.business.addressLabel}>
            {(control) => (
              <div className="relative">
                <MapPin className="text-muted-foreground pointer-events-none absolute top-3.5 left-3.5 h-5 w-5" />
                <Textarea
                  {...control}
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={x.addressPlaceholder}
                  data-testid="input-business-address"
                  className="min-h-0 rounded-xl py-2.5 pr-3.5 pl-11"
                />
              </div>
            )}
          </Field>

          {/* Optional Map Coordinates (Latitude / Longitude) */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="biz-latitude"
                label={dict.business.latitudeLabel}
                error={errors.latitude?.[0]}
              >
                <Input
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="48.8553"
                  aria-describedby="biz-coords-helper"
                  className="rounded-xl px-3.5 py-2.5 tabular-nums"
                  data-testid="input-business-latitude"
                />
              </Field>

              <Field
                id="biz-longitude"
                label={dict.business.longitudeLabel}
                error={errors.longitude?.[0]}
              >
                <Input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="2.3726"
                  aria-describedby="biz-coords-helper"
                  className="rounded-xl px-3.5 py-2.5 tabular-nums"
                  data-testid="input-business-longitude"
                />
              </Field>
            </div>
            <p id="biz-coords-helper" className="text-muted-foreground mt-1.5 text-xs">
              {dict.business.coordinatesHelper}
            </p>
          </div>
        </div>
      </div>

      <section className="mb-6" aria-labelledby="social-heading">
        <h2
          id="social-heading"
          className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase"
        >
          {dict.business.socialSection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-2xs">
          {(
            [
              ["instagramUrl", dict.business.instagramLabel],
              ["facebookUrl", dict.business.facebookLabel],
              ["tiktokUrl", dict.business.tiktokLabel],
            ] as const
          ).map(([field, label]) => (
            <Field key={field} id={`biz-${field}`} label={label} error={errors[field]?.[0]}>
              <Input
                type="url"
                value={socialLinks[field]}
                onChange={(e) => setSocialLinks({ ...socialLinks, [field]: e.target.value })}
                className="rounded-xl px-3.5 py-2.5"
                data-testid={`input-business-${field}`}
              />
            </Field>
          ))}
        </div>
      </section>

      {/* Section 3: Storefront Branding (Upcoming) */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.business.brandingSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border shadow-2xs">
          <SoonItem
            featureKey="business.cover_image"
            leading={<ImageIcon className="h-5 w-5" />}
            data-testid="soon-cover-image"
          />
          <SoonItem
            featureKey="business.brand_color"
            leading={<Palette className="h-5 w-5" />}
            data-testid="soon-brand-color"
          />
        </div>
      </div>

      {/* Sticky Save/Discard bar: above the manager bottom nav, static on desktop */}
      <ActionBar data-testid="settings-action-bar">
        <Button
          type="button"
          variant="outline"
          onClick={handleDiscard}
          disabled={isPending}
          data-testid="button-discard"
          className="flex-1 rounded-xl"
        >
          {dict.business.discardButton}
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          loading={isPending}
          data-testid="button-save-profile"
          className="flex-1 rounded-xl"
        >
          {isPending ? dict.saving : dict.business.saveButton}
        </Button>
      </ActionBar>
    </form>
  );
}
