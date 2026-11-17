"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronLeft,
  Camera,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Image as ImageIcon,
  Palette,
  Check,
  Copy,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { Business } from "@/domain/business";
import type { SettingsDictionary } from "@/domain/i18n";
import { SoonItem } from "@/components/feedback";
import { useToast } from "@/components/ui";
import { updateBusinessProfileAction } from "../actions";
import { actionErrorMessage } from "@/lib/actions/error-message";

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
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

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
  const [errors, setErrors] = useState<Record<string, string[]>>({});
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
    setErrors({});
    showToast("Changes discarded");
  };

  const handleCopyUrl = async () => {
    const fullUrl = `https://foodbiz.app/s/${slug || business.slug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      showToast("Store URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(fullUrl);
    }
  };

  const handleLogoUploadClick = () => {
    // In MVP, logo upload opens file input or sets mock logo
    showToast("Logo upload ready — select an image to preview");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
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
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        showToast(actionErrorMessage(res));
      }
    });
  };

  const storeInitial = name ? name[0].toUpperCase() : "B";

  return (
    <form
      onSubmit={handleSubmit}
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
        <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
          M-62
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-display-sm text-foreground font-bold tracking-tight">
          {dict.business.title}
        </h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.business.description}</p>
      </div>

      {/* Section 1: Storefront Identity */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.business.identitySection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-2xs">
          {/* Logo Uploader */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={name}
                  className="border-border h-16 w-16 rounded-full border object-cover"
                />
              ) : (
                <div className="bg-primary-soft text-primary-soft-foreground flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold">
                  {storeInitial}
                </div>
              )}
              <div className="bg-primary text-primary-foreground absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full shadow-xs">
                <Camera className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <label className="text-foreground block text-sm font-semibold">
                {dict.business.logoLabel}
              </label>
              <p className="text-body-sm text-muted-foreground mb-2">
                PNG, JPG or WebP (square 1:1)
              </p>
              <button
                type="button"
                onClick={handleLogoUploadClick}
                className="border-border bg-card hover:bg-muted text-foreground focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-2xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <Camera className="h-4 w-4" />
                <span>{dict.business.uploadLogo}</span>
              </button>
            </div>
          </div>

          {/* Business Name */}
          <div>
            <label
              htmlFor="biz-name"
              className="text-foreground mb-1.5 block text-sm font-semibold"
            >
              {dict.business.nameLabel} <span className="text-destructive">*</span>
            </label>
            <input
              id="biz-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={dict.business.namePlaceholder}
              className="border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-12 w-full rounded-xl border px-3.5 py-2.5 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
              data-testid="input-business-name"
            />
            {errors.name && (
              <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{errors.name[0]}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="biz-desc" className="text-foreground text-sm font-semibold">
                {dict.business.descLabel}
              </label>
              <span className="text-muted-foreground text-xs">{description.length}/500</span>
            </div>
            <textarea
              id="biz-desc"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={dict.business.descPlaceholder}
              className="border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-xl border px-3.5 py-2.5 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
              data-testid="input-business-description"
            />
          </div>

          {/* Storefront URL Slug */}
          <div>
            <label
              htmlFor="biz-slug"
              className="text-foreground mb-1.5 block text-sm font-semibold"
            >
              {dict.business.slugLabel} <span className="text-destructive">*</span>
            </label>
            <div className="border-input bg-card focus-within:ring-ring flex min-h-12 w-full items-center rounded-xl border transition-colors focus-within:ring-2">
              <span className="bg-muted text-muted-foreground flex h-full items-center rounded-l-xl px-3 font-mono text-sm select-none">
                {dict.business.slugHelper}
              </span>
              <input
                id="biz-slug"
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                disabled={Boolean(slugLockedReason)}
                aria-describedby={slugLockedReason ? "biz-slug-locked" : undefined}
                placeholder="la-petite-boulangerie"
                className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 px-3 py-2.5 font-mono text-base focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="input-business-slug"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                aria-label="Copy storefront URL"
                className="text-muted-foreground hover:text-foreground mr-1.5 flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
              >
                {copied ? <Check className="text-primary h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {slugLockedReason && (
              <p
                id="biz-slug-locked"
                className="text-muted-foreground mt-1.5 text-xs"
                data-testid="slug-owner-only-notice"
              >
                {slugLockedReason}
              </p>
            )}
            {errors.slug ? (
              <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{errors.slug[0]}</span>
              </p>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="bg-primary-soft text-primary-soft-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                  <Check className="h-3 w-3" />
                  <span>{dict.business.activeBadge}</span>
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  foodbiz.app/s/{slug || "slug"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Contact Information */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.business.contactSection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-2xs">
          {/* Phone */}
          <div>
            <label
              htmlFor="biz-phone"
              className="text-foreground mb-1.5 block text-sm font-semibold"
            >
              {dict.business.phoneLabel}
            </label>
            <div className="relative">
              <Phone className="text-muted-foreground absolute top-3.5 left-3.5 h-5 w-5" />
              <input
                id="biz-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 1 43 55 67 89"
                className="border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-12 w-full rounded-xl border py-2.5 pr-3.5 pl-11 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
                data-testid="input-business-phone"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="biz-email"
              className="text-foreground mb-1.5 block text-sm font-semibold"
            >
              {dict.business.emailLabel}
            </label>
            <div className="relative">
              <Mail className="text-muted-foreground absolute top-3.5 left-3.5 h-5 w-5" />
              <input
                id="biz-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="bonjour@lapetiteboulangerie.fr"
                className="border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-12 w-full rounded-xl border py-2.5 pr-3.5 pl-11 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
                data-testid="input-business-email"
              />
            </div>
            {errors.email && (
              <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{errors.email[0]}</span>
              </p>
            )}
          </div>

          {/* WhatsApp */}
          <div>
            <label
              htmlFor="biz-whatsapp"
              className="text-foreground mb-1.5 block text-sm font-semibold"
            >
              {dict.business.whatsappLabel}
            </label>
            <div className="relative">
              <MessageCircle className="text-muted-foreground absolute top-3.5 left-3.5 h-5 w-5" />
              <input
                id="biz-whatsapp"
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                className="border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-12 w-full rounded-xl border py-2.5 pr-3.5 pl-11 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
                data-testid="input-business-whatsapp"
              />
            </div>
          </div>

          {/* Physical Address */}
          <div>
            <label
              htmlFor="biz-address"
              className="text-foreground mb-1.5 block text-sm font-semibold"
            >
              {dict.business.addressLabel}
            </label>
            <div className="relative">
              <MapPin className="text-muted-foreground absolute top-3.5 left-3.5 h-5 w-5" />
              <textarea
                id="biz-address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="12 Rue de la Roquette, 75011 Paris, France"
                className="border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-xl border py-2.5 pr-3.5 pl-11 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
                data-testid="input-business-address"
              />
            </div>
          </div>

          {/* Optional Map Coordinates (Latitude / Longitude) */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="biz-latitude"
                  className="text-foreground mb-1.5 block text-sm font-semibold"
                >
                  {dict.business.latitudeLabel}
                </label>
                <input
                  id="biz-latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="48.8553"
                  aria-describedby="biz-coords-helper"
                  aria-invalid={!!errors.latitude}
                  className="border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-12 w-full rounded-xl border px-3.5 py-2.5 text-base tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  data-testid="input-business-latitude"
                />
                {errors.latitude && (
                  <p role="alert" className="text-destructive mt-1 text-xs">
                    {errors.latitude[0]}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="biz-longitude"
                  className="text-foreground mb-1.5 block text-sm font-semibold"
                >
                  {dict.business.longitudeLabel}
                </label>
                <input
                  id="biz-longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="2.3726"
                  aria-describedby="biz-coords-helper"
                  aria-invalid={!!errors.longitude}
                  className="border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-12 w-full rounded-xl border px-3.5 py-2.5 text-base tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  data-testid="input-business-longitude"
                />
                {errors.longitude && (
                  <p role="alert" className="text-destructive mt-1 text-xs">
                    {errors.longitude[0]}
                  </p>
                )}
              </div>
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
          className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase"
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
            <div key={field}>
              <label
                htmlFor={`biz-${field}`}
                className="text-foreground mb-1.5 block text-sm font-semibold"
              >
                {label}
              </label>
              <input
                id={`biz-${field}`}
                type="url"
                value={socialLinks[field]}
                onChange={(e) => setSocialLinks({ ...socialLinks, [field]: e.target.value })}
                aria-invalid={!!errors[field]}
                aria-describedby={errors[field] ? `error-${field}` : undefined}
                className="border-input bg-card text-foreground focus-visible:ring-ring min-h-12 w-full rounded-xl border px-3.5 py-2.5 text-base focus-visible:ring-2 focus-visible:outline-none"
                data-testid={`input-business-${field}`}
              />
              {errors[field] && (
                <p id={`error-${field}`} role="alert" className="text-destructive mt-1 text-xs">
                  {errors[field][0]}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Storefront Branding (Upcoming) */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
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

      {/* Sticky Action Bar */}
      <div className="border-border bg-card/95 fixed inset-x-0 bottom-0 z-30 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur-md md:static md:bg-transparent md:p-0 md:shadow-none">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={handleDiscard}
            className="border-border bg-card hover:bg-muted text-foreground focus-visible:ring-ring flex min-h-12 flex-1 items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
            data-testid="button-discard"
          >
            {dict.business.discardButton}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/95 focus-visible:ring-primary flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
            data-testid="button-save-profile"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{dict.business.saveButton}</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
