import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { colors, radius, spacing, typography } from "@/theme";
import { getDevice } from "@/firebase/devices";
import {
  approveUploadAccessRequest,
  getAuthorizedUploaders,
  getUploadAccessRequests,
  rejectUploadAccessRequest,
  revokeUploadAccess,
  type AuthorizedUploader,
  type UploadAccessRequest,
} from "@/firebase/permissions";

function formatDate(value: Date | null): string {
  return value
    ? value.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "Data indisponível";
}

export default function PermissionsScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const [deviceName, setDeviceName] = useState("");
  const [requests, setRequests] = useState<UploadAccessRequest[]>([]);
  const [grants, setGrants] = useState<AuthorizedUploader[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [device, pending, authorized] = await Promise.all([
        getDevice(deviceId),
        getUploadAccessRequests(deviceId),
        getAuthorizedUploaders(deviceId),
      ]);
      if (!device) throw new Error("Quadro não encontrado.");
      setDeviceName(device.name);
      setRequests(pending.sort((a, b) =>
        (a.requestedAt?.getTime() ?? 0) - (b.requestedAt?.getTime() ?? 0),
      ));
      setGrants(authorized.sort((a, b) => a.email.localeCompare(b.email)));
    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
      Alert.alert("Erro", "Não foi possível carregar as permissões.");
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const perform = async (uid: string, action: () => Promise<void>) => {
    try {
      setBusyUid(uid);
      await action();
      await load();
    } catch (error) {
      console.error("Erro ao alterar permissão:", error);
      Alert.alert("Erro", "Não foi possível concluir a operação. Tente novamente.");
    } finally {
      setBusyUid(null);
    }
  };

  const approve = (request: UploadAccessRequest) => {
    void perform(request.uid, () =>
      approveUploadAccessRequest(deviceId, request.uid, deviceName),
    );
  };

  const reject = (request: UploadAccessRequest) => {
    Alert.alert("Recusar solicitação", `Recusar o pedido de ${request.email}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Recusar",
        style: "destructive",
        onPress: () => void perform(request.uid, () =>
          rejectUploadAccessRequest(deviceId, request.uid),
        ),
      },
    ]);
  };

  const revoke = (grant: AuthorizedUploader) => {
    Alert.alert("Revogar acesso", `Remover o acesso de ${grant.email} a este quadro?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Revogar",
        style: "destructive",
        onPress: () => void perform(grant.uid, () =>
          revokeUploadAccess(deviceId, grant.uid),
        ),
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scroll>
        <ScreenHeader
          title="Permissões"
          subtitle={deviceName || "Gerencie quem pode enviar fotos"}
          showBackButton
        />

        <View style={styles.heading}>
          <Text style={styles.title}>Solicitações pendentes</Text>
          <Pressable onPress={() => void load()} disabled={loading || busyUid !== null} style={styles.refresh}>
            <Feather name="refresh-cw" size={20} color={colors.primary} />
            <Text style={styles.refreshText}>Atualizar</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <>
            {requests.length === 0 ? (
              <Text style={styles.empty}>Nenhuma solicitação pendente.</Text>
            ) : (
              <View style={styles.list}>
                {requests.map((request) => (
                  <Card key={request.uid} style={styles.entry}>
                    <Text style={styles.email} selectable>{request.email}</Text>
                    <Text style={styles.date}>Solicitado em {formatDate(request.requestedAt)}</Text>
                    <View style={styles.actions}>
                      <Pressable
                        style={[styles.action, styles.reject]}
                        onPress={() => reject(request)}
                        disabled={busyUid !== null}
                      >
                        <Text style={styles.rejectText}>Recusar</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.action, styles.approve]}
                        onPress={() => approve(request)}
                        disabled={busyUid !== null}
                      >
                        {busyUid === request.uid ? <ActivityIndicator color={colors.white} /> :
                          <Text style={styles.approveText}>Autorizar</Text>}
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </View>
            )}

            <Text style={[styles.title, styles.grantsTitle]}>Pessoas autorizadas</Text>
            {grants.length === 0 ? (
              <Text style={styles.empty}>Nenhuma autorização registrada nesta tela.</Text>
            ) : (
              <View style={styles.list}>
                {grants.map((grant) => (
                  <Card key={grant.uid} style={styles.entry}>
                    <Text style={styles.email} selectable>{grant.email}</Text>
                    <Text style={styles.date}>Autorizado em {formatDate(grant.grantedAt)}</Text>
                    <Pressable
                      style={[styles.action, styles.reject, styles.revoke]}
                      onPress={() => revoke(grant)}
                      disabled={busyUid !== null}
                    >
                      {busyUid === grant.uid ? <ActivityIndicator color={colors.danger} /> :
                        <Text style={styles.rejectText}>Revogar acesso</Text>}
                    </Pressable>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { ...typography.sectionTitle, color: colors.text, flexShrink: 1 },
  refresh: { flexDirection: "row", alignItems: "center", gap: 6, padding: 7 },
  refreshText: { color: colors.primary, fontWeight: "600" },
  loading: { paddingVertical: spacing.xxl },
  empty: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  list: { gap: spacing.md, marginTop: spacing.md },
  entry: { gap: spacing.sm },
  email: { ...typography.cardTitle, color: colors.text },
  date: { ...typography.metadata, color: colors.textSecondary },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  action: { minHeight: 42, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center", alignItems: "center" },
  reject: { borderWidth: 1, borderColor: colors.border },
  rejectText: { fontWeight: "600", color: colors.danger },
  approve: { backgroundColor: colors.primary },
  approveText: { fontWeight: "600", color: colors.white },
  grantsTitle: { marginTop: spacing.xxxl },
  revoke: { alignSelf: "flex-end", marginTop: spacing.sm },
});
