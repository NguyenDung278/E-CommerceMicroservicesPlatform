import { useEffect, useState, type ChangeEvent } from "react";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getErrorMessage } from "@/services/api";
import { userApi } from "@/services/api/modules/user-api";

const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function useProfileAvatarUpload() {
  const { refreshProfile, token, user } = useAuth();
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!selectedAvatarFile) {
      setAvatarUrl(user?.avatar_url || "");
    }
  }, [selectedAvatarFile, user?.avatar_url]);

  useEffect(() => {
    if (!selectedAvatarFile) {
      setAvatarPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedAvatarFile);
    setAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedAvatarFile]);

  function resetAvatarFeedback() {
    setAvatarError("");
    setAvatarSuccess("");
  }

  async function uploadAvatar(fileOverride?: File) {
    const fileToUpload = fileOverride ?? selectedAvatarFile;

    if (!fileToUpload) {
      setAvatarError("Choose an image before uploading.");
      return;
    }

    if (!token) {
      setAvatarError("Your session has expired. Please sign in again.");
      return;
    }

    try {
      setIsUploadingAvatar(true);
      resetAvatarFeedback();

      const response = await userApi.uploadAvatar(token, fileToUpload);
      let refreshedProfile = null;

      try {
        refreshedProfile = await refreshProfile();
      } catch {
        refreshedProfile = null;
      }

      const nextAvatarUrl =
        refreshedProfile?.avatar_url ||
        response.data.user?.avatar_url ||
        response.data.avatar_url ||
        "";

      if (nextAvatarUrl) {
        setAvatarUrl(nextAvatarUrl);
      }

      setSelectedAvatarFile(null);
      setAvatarSuccess("Avatar updated successfully.");
    } catch (reason) {
      setAvatarError(getErrorMessage(reason));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    resetAvatarFeedback();

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSelectedAvatarFile(null);
      setAvatarError("Please choose a valid image file.");
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      setSelectedAvatarFile(null);
      setAvatarError("Avatar image must be smaller than 5MB.");
      return;
    }

    setSelectedAvatarFile(file);
    void uploadAvatar(file);
  }

  function clearSelectedAvatar() {
    setSelectedAvatarFile(null);
    resetAvatarFeedback();
  }

  return {
    avatarError,
    avatarSuccess,
    displayedAvatarUrl: avatarPreviewUrl || avatarUrl,
    handleAvatarChange,
    isUploadingAvatar,
    retryAvatarUpload: () => void uploadAvatar(),
    selectedAvatarFile,
    clearSelectedAvatar,
  };
}
