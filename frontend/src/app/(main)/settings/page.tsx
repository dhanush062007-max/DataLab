"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Settings as SettingsIcon, 
  User, 
  Moon, 
  Key, 
  ShieldAlert, 
  SlidersHorizontal,
  LogOut,
  Save,
  Trash2,
  RefreshCw,
  Bell,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SettingsTab = "profile" | "appearance" | "integrations" | "preferences" | "danger";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    }
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-2rem)] items-center justify-center text-muted-foreground">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto h-full flex flex-col p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm md:text-base text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-1 overflow-x-auto pb-1 md:pb-0 shrink-0">
          <TabButton 
            active={activeTab === "profile"} 
            onClick={() => setActiveTab("profile")} 
            icon={<User className="w-4 h-4" />} 
            label="Profile" 
          />
          <TabButton 
            active={activeTab === "appearance"} 
            onClick={() => setActiveTab("appearance")} 
            icon={<Moon className="w-4 h-4" />} 
            label="Appearance" 
          />
          <TabButton 
            active={activeTab === "integrations"} 
            onClick={() => setActiveTab("integrations")} 
            icon={<Key className="w-4 h-4" />} 
            label="API & Integrations" 
          />
          <TabButton 
            active={activeTab === "preferences"} 
            onClick={() => setActiveTab("preferences")} 
            icon={<SlidersHorizontal className="w-4 h-4" />} 
            label="Preferences" 
          />
          <TabButton 
            active={activeTab === "danger"} 
            onClick={() => setActiveTab("danger")} 
            icon={<ShieldAlert className="w-4 h-4" />} 
            label="Danger Zone" 
            danger
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-card border border-border rounded-xl p-6 shadow-sm overflow-y-auto">
          {activeTab === "profile" && <ProfileSettings user={user} setUser={setUser} />}
          {activeTab === "appearance" && <AppearanceSettings />}
          {activeTab === "integrations" && <IntegrationSettings />}
          {activeTab === "preferences" && <PreferencesSettings />}
          {activeTab === "danger" && <DangerZone user={user} />}
        </div>
      </div>
    </div>
  );
}

// Sub-components

function TabButton({ active, onClick, icon, label, danger = false }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? (danger ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-primary/10 text-primary")
          : (danger ? "hover:bg-red-50 text-red-600/70 dark:hover:bg-red-900/10" : "bg-muted/50 md:bg-transparent hover:bg-muted text-muted-foreground")
      }`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function ProfileSettings({ user, setUser }: { user: any, setUser: any }) {
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [roleTitle, setRoleTitle] = useState(user?.user_metadata?.role_title || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: fullName, role_title: roleTitle }
      });
      if (error) throw error;
      setUser(data.user);
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">Profile Settings</h3>
        <p className="text-sm text-muted-foreground">Update your personal information.</p>
      </div>
      
      {message && (
        <div className={`p-3 text-sm rounded-md border flex items-start gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-semibold mb-1">Email Address</label>
          <input 
            type="email" 
            value={user?.email || ""} 
            disabled 
            className="w-full bg-muted border border-border text-sm rounded-md p-2 text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">Email cannot be changed directly.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Full Name</label>
          <input 
            type="text" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            className="w-full bg-background border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Role / Title</label>
          <input 
            type="text" 
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="Data Scientist"
            className="w-full bg-background border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [density, setDensity] = useState<"compact" | "default" | "comfortable">("default");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as any;
    if (savedTheme) {
      setTheme(savedTheme);
    }
    
    const savedDensity = localStorage.getItem("density") as any;
    if (savedDensity) {
      setDensity(savedDensity);
    }
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (newTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      // System
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const handleDensityChange = (newDensity: "compact" | "default" | "comfortable") => {
    setDensity(newDensity);
    localStorage.setItem("density", newDensity);
    document.documentElement.setAttribute("data-density", newDensity);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">Appearance</h3>
        <p className="text-sm text-muted-foreground">Customize how DataLab looks on your device.</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Theme</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
            <button 
              onClick={() => handleThemeChange("light")}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl bg-card hover:bg-muted transition-colors ${theme === 'light' ? 'border-primary' : 'border-transparent'}`}
            >
              <div className="w-full h-20 bg-white rounded border border-gray-200 shadow-sm flex flex-col p-2 gap-2">
                <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
                <div className="h-2 w-full bg-gray-100 rounded"></div>
                <div className="h-2 w-full bg-gray-100 rounded"></div>
              </div>
              <span className="text-sm font-medium">Light</span>
            </button>
            <button 
              onClick={() => handleThemeChange("dark")}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl bg-card hover:bg-muted transition-colors ${theme === 'dark' ? 'border-primary' : 'border-transparent'}`}
            >
              <div className="w-full h-20 bg-gray-900 rounded border border-gray-700 shadow-sm flex flex-col p-2 gap-2">
                <div className="h-3 w-3/4 bg-gray-700 rounded"></div>
                <div className="h-2 w-full bg-gray-800 rounded"></div>
                <div className="h-2 w-full bg-gray-800 rounded"></div>
              </div>
              <span className="text-sm font-medium">Dark</span>
            </button>
            <button 
              onClick={() => handleThemeChange("system")}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl bg-card hover:bg-muted transition-colors ${theme === 'system' ? 'border-primary' : 'border-transparent'}`}
            >
              <div className="w-full h-20 bg-gradient-to-r from-white to-gray-900 rounded border border-gray-400 shadow-sm flex flex-col p-2 gap-2">
                <div className="h-3 w-3/4 bg-gray-400 rounded"></div>
                <div className="h-2 w-full bg-gray-300 rounded"></div>
                <div className="h-2 w-full bg-gray-300 rounded"></div>
              </div>
              <span className="text-sm font-medium">System</span>
            </button>
          </div>
        </div>

        <div className="pt-6 mt-4 border-t border-border">
          <label className="block text-sm font-semibold mb-2">UI Density</label>
          <p className="text-sm text-muted-foreground mb-4">Adjust the compactness of the interface.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
            <button 
              onClick={() => handleDensityChange("compact")}
              className={`flex flex-col items-start gap-2 p-4 border-2 rounded-xl bg-card hover:bg-muted transition-colors text-left ${density === 'compact' ? 'border-primary' : 'border-transparent'}`}
            >
              <div className="w-full space-y-1 opacity-70">
                <div className="h-1.5 w-full bg-foreground rounded-full"></div>
                <div className="h-1.5 w-full bg-foreground rounded-full"></div>
                <div className="h-1.5 w-3/4 bg-foreground rounded-full"></div>
              </div>
              <div>
                <div className="font-medium text-sm mt-2">Compact</div>
                <div className="text-[10px] text-muted-foreground">Dense data views</div>
              </div>
            </button>
            <button 
              onClick={() => handleDensityChange("default")}
              className={`flex flex-col items-start gap-2 p-4 border-2 rounded-xl bg-card hover:bg-muted transition-colors text-left ${density === 'default' ? 'border-primary' : 'border-transparent'}`}
            >
              <div className="w-full space-y-2 opacity-70">
                <div className="h-2 w-full bg-foreground rounded-full"></div>
                <div className="h-2 w-full bg-foreground rounded-full"></div>
                <div className="h-2 w-3/4 bg-foreground rounded-full"></div>
              </div>
              <div>
                <div className="font-medium text-sm mt-2">Default</div>
                <div className="text-[10px] text-muted-foreground">Standard spacing</div>
              </div>
            </button>
            <button 
              onClick={() => handleDensityChange("comfortable")}
              className={`flex flex-col items-start gap-2 p-4 border-2 rounded-xl bg-card hover:bg-muted transition-colors text-left ${density === 'comfortable' ? 'border-primary' : 'border-transparent'}`}
            >
              <div className="w-full space-y-3 opacity-70">
                <div className="h-2.5 w-full bg-foreground rounded-full"></div>
                <div className="h-2.5 w-full bg-foreground rounded-full"></div>
                <div className="h-2.5 w-3/4 bg-foreground rounded-full"></div>
              </div>
              <div>
                <div className="font-medium text-sm mt-2">Comfortable</div>
                <div className="text-[10px] text-muted-foreground">Max breathing room</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationSettings() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [hfToken, setHfToken] = useState("");

  useEffect(() => {
    setOpenaiKey(localStorage.getItem("openai_key") || "");
    setHfToken(localStorage.getItem("hf_token") || "");
  }, []);

  const saveOpenaiKey = () => {
    localStorage.setItem("openai_key", openaiKey);
    alert("OpenAI key saved locally in your browser.");
  };

  const saveHfToken = () => {
    localStorage.setItem("hf_token", hfToken);
    alert("HuggingFace token saved locally in your browser.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">API & Integrations</h3>
        <p className="text-sm text-muted-foreground">Connect DataLab with external services. Keys are saved securely in your browser's local storage.</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="p-4 border border-border rounded-xl bg-background space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold">OpenAI API Key</h4>
              <p className="text-sm text-muted-foreground">Used for AI-assisted data cleaning and SQL generation.</p>
            </div>
            {openaiKey ? (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">Configured</span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-semibold">Not Configured</span>
            )}
          </div>
          <div className="flex gap-2">
            <input 
              type="password" 
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..." 
              className="flex-1 bg-background border border-border text-sm rounded-md p-2 font-mono outline-none focus:ring-1 focus:ring-primary"
            />
            <Button variant="outline" onClick={saveOpenaiKey}>Save Key</Button>
          </div>
        </div>

        <div className="p-4 border border-border rounded-xl bg-background space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold">HuggingFace Token</h4>
              <p className="text-sm text-muted-foreground">Used for fetching pre-trained ML models and embeddings.</p>
            </div>
            {hfToken ? (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">Configured</span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-semibold">Not Configured</span>
            )}
          </div>
          <div className="flex gap-2">
            <input 
              type="password" 
              value={hfToken}
              onChange={(e) => setHfToken(e.target.value)}
              placeholder="hf_..." 
              className="flex-1 bg-background border border-border text-sm rounded-md p-2 font-mono focus:ring-1 focus:ring-primary outline-none"
            />
            <Button variant="outline" onClick={saveHfToken}>Save Token</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferencesSettings() {
  const [delimiter, setDelimiter] = useState(",");
  const [emailNotifs, setEmailNotifs] = useState(true);

  useEffect(() => {
    const savedDelim = localStorage.getItem("csv_delimiter");
    if (savedDelim) setDelimiter(savedDelim);
    
    const savedNotifs = localStorage.getItem("email_notifs");
    if (savedNotifs !== null) setEmailNotifs(savedNotifs === "true");
  }, []);

  const handleDelimiterChange = (e: any) => {
    const val = e.target.value;
    setDelimiter(val);
    localStorage.setItem("csv_delimiter", val);
  };

  const handleNotifsChange = (e: any) => {
    const val = e.target.checked;
    setEmailNotifs(val);
    localStorage.setItem("email_notifs", val.toString());
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold">Preferences</h3>
        <p className="text-sm text-muted-foreground">Customize your workflow.</p>
      </div>
      
      <div className="space-y-6 max-w-xl">
        
        <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-background">
          <div className="space-y-1">
            <h4 className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4"/> Email Notifications</h4>
            <p className="text-sm text-muted-foreground">Receive emails when long-running ML jobs complete.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={emailNotifs} onChange={handleNotifsChange} />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Default CSV Delimiter</label>
          <select 
            value={delimiter}
            onChange={handleDelimiterChange}
            className="bg-background border border-border text-sm rounded-md p-2 focus:ring-1 focus:ring-primary outline-none max-w-xs w-full"
          >
            <option value=",">Comma (,)</option>
            <option value=";">Semicolon (;)</option>
            <option value="\t">Tab (\t)</option>
            <option value="|">Pipe (|)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function DangerZone({ user }: { user: any }) {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);

  const handleClearWorkspace = async () => {
    if (!confirm("Are you absolutely sure you want to clear all datasets? This will delete everything in your workspace!")) return;
    
    setClearing(true);
    try {
      // Due to RLS, this will only delete the user's own datasets.
      // And due to ON DELETE CASCADE on the DB, this will wipe experiments, stats, etc.
      const { error } = await supabase.from("datasets").delete().neq("id", "00000000-0000-0000-0000-000000000000"); 
      if (error) throw error;
      alert("Workspace cleared successfully!");
    } catch (err: any) {
      alert("Error clearing workspace: " + err.message);
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Delete your account? You will be signed out and your data will be abandoned.")) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-red-600 dark:text-red-400">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">Irreversible and destructive actions.</p>
      </div>

      <div className="space-y-4 max-w-2xl border border-red-200 dark:border-red-900/50 rounded-xl overflow-hidden">
        
        <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-card border-b border-red-100 dark:border-red-900/30">
          <div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100">Clear all datasets</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Permanently remove all datasets, experiments, and reports from your workspace.</p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleClearWorkspace}
            disabled={clearing}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shrink-0"
          >
            {clearing ? "Clearing..." : "Clear Workspace"}
          </Button>
        </div>

        <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-card">
          <div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100">Delete Account</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sign out and abandon account data.</p>
          </div>
          <Button onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700 text-white shrink-0">
            Delete Account
          </Button>
        </div>

      </div>
    </div>
  );
}
