"use client";

import { useState } from "react";
import { useNetwork } from "@/lib/NetworkContext";
import { SUPPORTED_NETWORKS } from "@/lib/networks";
import { isValidWssUrl, testConnection } from "@/lib/polkadotApi";

export default function NetworkSelector() {
  const {
    selectedNetwork,
    customUrls,
    setNetwork,
    setCustomUrl,
    getActiveWssUrl,
    resetCustomUrl,
  } = useNetwork();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editUrl, setEditUrl] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [urlError, setUrlError] = useState<string>("");

  const handleOpenModal = () => {
    setEditUrl(getActiveWssUrl());
    setIsModalOpen(true);
    setTestResult(null);
    setUrlError("");
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditUrl("");
    setTestResult(null);
    setUrlError("");
  };

  const handleSave = () => {
    if (!isValidWssUrl(editUrl)) {
      setUrlError("Invalid WebSocket URL. Must start with ws:// or wss://");
      return;
    }

    if (editUrl === selectedNetwork.assetHubWss) {
      // If setting to default, remove custom URL
      resetCustomUrl(selectedNetwork.id);
    } else {
      setCustomUrl(selectedNetwork.id, editUrl);
    }
    handleCloseModal();
  };

  const handleReset = () => {
    setEditUrl(selectedNetwork.assetHubWss);
    setUrlError("");
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!isValidWssUrl(editUrl)) {
      setUrlError("Invalid WebSocket URL. Must start with ws:// or wss://");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setUrlError("");

    try {
      const isValid = await testConnection(editUrl);
      if (isValid) {
        setTestResult({ success: true, message: "Connection successful!" });
      } else {
        setTestResult({
          success: false,
          message: "Connection failed. Please check the URL.",
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isCustomUrl = customUrls[selectedNetwork.id] !== undefined;

  return (
    <>
      <div className="flex items-center gap-3">
        <select
          id="network-select"
          value={selectedNetwork.id}
          onChange={(e) => setNetwork(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          {SUPPORTED_NETWORKS.map((network) => (
            <option key={network.id} value={network.id}>
              {network.name}
              {customUrls[network.id] ? " (Custom)" : ""}
            </option>
          ))}
        </select>

        <button
          onClick={handleOpenModal}
          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Edit WSS URL"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Edit WSS URL for {selectedNetwork.name}
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="wss-url"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  AssetHub WSS URL
                </label>
                <input
                  id="wss-url"
                  type="text"
                  value={editUrl}
                  onChange={(e) => {
                    setEditUrl(e.target.value);
                    setUrlError("");
                    setTestResult(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="wss://..."
                />
                {urlError && (
                  <p className="mt-1 text-sm text-red-600">{urlError}</p>
                )}
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-md ${
                    testResult.success
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  <p className="text-sm">{testResult.message}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTesting ? "Testing..." : "Test Connection"}
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Reset to Default
                </button>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
