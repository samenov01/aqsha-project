import * as faceapi from "face-api.js";
import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "../i18n";

type FaceCameraProps = {
    onDescriptor: (descriptor: number[]) => Promise<void>;
    onCancel: () => void;
    actionLabel?: string;
};

let modelsLoaded = false;

export function FaceCamera({ onDescriptor, onCancel, actionLabel }: FaceCameraProps) {
    const { t } = useTranslation();
    const finalActionLabel = actionLabel || t("facecam.action_default");
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [status, setStatus] = useState<"loading" | "scanning" | "checking" | "success" | "error">("loading");
    const [statusText, setStatusText] = useState(t("facecam.loading_models"));

    /* Load models once */
    useEffect(() => {
        let cancelled = false;

        async function init() {
            try {
                if (!modelsLoaded) {
                    setStatusText(t("facecam.loading_models"));
                    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
                    await faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models");
                    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
                    modelsLoaded = true;
                }

                if (cancelled) return;
                setStatusText(t("facecam.starting_cam"));

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user", width: 480, height: 360 },
                });
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                setStatus("scanning");
                setStatusText(t("facecam.look_camera"));
            } catch (err) {
                if (!cancelled) {
                    console.error("FaceCamera init error:", err);
                    setStatus("error");
                    setStatusText(t("facecam.error_cam"));
                }
            }
        }

        init();

        return () => {
            cancelled = true;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    /* Automated scanning loop */
    const scanLoop = useCallback(async () => {
        if (!videoRef.current || status !== "scanning") return;

        try {
            const detection = await faceapi
                .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            if (status !== "scanning") return;

            if (detection) {
                /* Draw detection */
                if (canvasRef.current && videoRef.current) {
                    const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
                    const resized = faceapi.resizeResults(detection, dims);
                    faceapi.draw.drawDetections(canvasRef.current, resized);
                    faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
                }

                setStatus("checking");
                setStatusText(t("facecam.checking"));

                const descriptor = Array.from(detection.descriptor);
                try {
                    await onDescriptor(descriptor);

                    setStatus("success");
                    setStatusText(t("facecam.success"));
                    if (streamRef.current) {
                        streamRef.current.getTracks().forEach((t) => t.stop());
                    }
                } catch (err) {
                    setStatus("scanning");
                    setStatusText(t("facecam.retry"));
                    setTimeout(scanLoop, 1000); // Wait 1s before retrying
                }
            } else {
                setStatusText(t("facecam.look_camera"));
                setTimeout(scanLoop, 300); // Keep looking
            }
        } catch (err) {
            console.error("Face detection error:", err);
            setTimeout(scanLoop, 1000);
        }
    }, [status, onDescriptor]);

    function handleVideoPlay() {
        if (status === "scanning") {
            scanLoop();
        }
    }

    function handleCancel() {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }
        onCancel();
    }

    return (
        <div className="facecam-overlay">
            <div className="facecam-card">
                <div className="facecam-header">
                    <p className="eyebrow">FaceID</p>
                    <h3>{finalActionLabel}</h3>
                    <p className="muted">{statusText}</p>
                </div>

                <div className="facecam-video-wrap" style={{ position: "relative", width: 480, maxWidth: "100%", aspectRatio: "4/3" }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        onPlay={handleVideoPlay}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px", transform: "scaleX(-1)", opacity: status === "success" ? 0.5 : 1, transition: "opacity 0.3s" }}
                    />
                    <canvas
                        ref={canvasRef}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: "12px", transform: "scaleX(-1)", display: status === "success" ? "none" : "block" }}
                    />

                    {/* Анимация сканирования: рамки и бегающая полоса */}
                    <div className={`facecam - scanner ${status === "scanning" ? "active" : ""} `}>
                        <div className="facecam-scanner-line"></div>
                    </div>

                    {/* Apple-style checkmark on success */}
                    {status === "success" && (
                        <div className="apple-checkmark">
                            <svg viewBox="0 0 52 52">
                                <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                            </svg>
                        </div>
                    )}
                </div>

                <div className="facecam-actions" style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                    {status === "loading" && (
                        <button className="primary" disabled>{t("facecam.btn.loading")}</button>
                    )}
                    {status === "scanning" && (
                        <button className="primary" disabled>{t("facecam.btn.scanning")}</button>
                    )}
                    {status === "checking" && (
                        <button className="primary" disabled>{t("facecam.btn.checking")}</button>
                    )}
                    {status === "success" && (
                        <button className="primary" disabled style={{ background: "#2cbd5a" }}>{t("facecam.btn.done")}</button>
                    )}
                    <button className="ghost" onClick={handleCancel}>{t("facecam.btn.cancel")}</button>
                </div>
            </div>
        </div>
    );
}
