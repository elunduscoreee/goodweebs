import { useActionSheet } from "@expo/react-native-action-sheet";
import { RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { formatDistanceToNow, add } from "date-fns";
import * as Haptics from "expo-haptics";
import _ from "lodash";
import React, { useState } from "react";
import { StyleSheet, RefreshControl, Text, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import HTMLView from "react-native-htmlview";
import { useSafeArea } from "react-native-safe-area-context";
import title from "title";

import { EmptyState } from "yep/components/EmptyState";
import { MediaListStatusWithLabel, MediaStatusWithLabel } from "yep/constants";
import {
  GetAnimeQuery,
  MediaStatus,
  UpdateStatusMutation,
  UpdateStatusMutationVariables,
  UpdateScoreMutation,
  UpdateScoreMutationVariables,
  UpdateProgressMutation,
  UpdateProgressMutationVariables,
  MediaRelation,
  AnimeRelationFragmentFragment,
  MediaType,
  MediaList,
  useGetAnimeQuery,
  GetAnimeDocument,
  UpdateProgressDocument,
  UpdateScoreDocument,
  UpdateStatusDocument,
} from "yep/graphql/generated";
import { useNow, useDebouncedMutation } from "yep/hooks/helpers";
import { RootStackParamList } from "yep/navigation";
import { takimoto } from "yep/takimoto";
import { darkTheme } from "yep/themes";
import { Manrope } from "yep/typefaces";
import { notEmpty } from "yep/utils";

import { Button } from "./Button";
import { ExternalLink } from "./ExternalLink";
import { RelatedList } from "./RelatedList";
import { Stepper } from "./Stepper";

const Container = takimoto.ScrollView({
  flex: 1,
  padding: 16,
});

const Poster = takimoto.Image({
  height: 186,
  width: 128,
  borderRadius: 4,
  marginRight: 16,
});

const Title = takimoto.Text({
  color: darkTheme.text,
  fontFamily: Manrope.extraBold,
  fontSize: 31.25,
  marginBottom: 16,
});

const InfoRow = takimoto.View({
  flexDirection: "row",
});

const InfoRowSpacer = takimoto.View({
  height: 8,
});

const InfoTable = takimoto.View({
  flex: 1,
});

const InfoContainer = takimoto.View({
  flex: 1,
});

const InfoLabel = takimoto.Text({
  fontFamily: Manrope.regular,
  fontSize: 12.8,
  color: darkTheme.text,
  marginBottom: 4,
});

const InfoValue = takimoto.Text({
  fontFamily: Manrope.semiBold,
  fontSize: 16,
  color: darkTheme.text,
});

const PosterAndInfoContainer = takimoto.View({
  flexDirection: "row",
  marginBottom: 16,
});

type InfoProps = { label: string; value: string };

function Info({ label, value }: InfoProps) {
  return (
    <InfoContainer>
      <InfoLabel numberOfLines={1}>{label}</InfoLabel>
      <InfoValue numberOfLines={2}>{value}</InfoValue>
    </InfoContainer>
  );
}

const ButtonsRow = takimoto.View({
  flexDirection: "row",
  width: "100%",
  alignItems: "center",
  marginBottom: 16,
});

type Props = {
  navigation: StackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, "Details">;
};

export function DetailsScreen({ route, navigation }: Props) {
  const { showActionSheetWithOptions } = useActionSheet();
  const insets = useSafeArea();
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [
    isRefetchingFromScrollOrMount,
    setIsRefetchingFromScrollOrMount,
  ] = useState(true);

  const now = useNow();

  const { loading, data, refetch } = useGetAnimeQuery({
    variables: { id: route.params.id },
    notifyOnNetworkStatusChange: true,
  });

  const updateStatus = useDebouncedMutation<
    UpdateStatusMutation,
    UpdateStatusMutationVariables
  >({
    mutationDocument: UpdateStatusDocument,
    makeUpdateFunction: (variables) => (proxy) => {
      // Read the data from our cache for this query.
      const proxyData = proxy.readQuery<GetAnimeQuery>({
        query: GetAnimeDocument,
        variables: { id: route.params.id },
      });

      if (proxyData?.Media?.mediaListEntry) {
        // Write our data back to the cache with the new progress in it
        proxy.writeQuery<GetAnimeQuery>({
          query: GetAnimeDocument,
          variables: { id: route.params.id },
          data: {
            ...proxyData,
            Media: {
              ...proxyData?.Media,
              id: proxyData?.Media?.id as number,
              mediaListEntry: {
                ...(proxyData?.Media?.mediaListEntry as MediaList),
                status: variables?.status,
              },
            },
          },
        });
      } else {
        refetchSilently();
      }
    },
    wait: 0,
  });

  const updateScore = useDebouncedMutation<
    UpdateScoreMutation,
    UpdateScoreMutationVariables
  >({
    mutationDocument: UpdateScoreDocument,
    makeUpdateFunction: (variables) => (proxy) => {
      // Read the data from our cache for this query.
      const proxyData = proxy.readQuery<GetAnimeQuery>({
        query: GetAnimeDocument,
        variables: { id: route.params.id },
      });

      // Write our data back to the cache with the new progress in it
      proxy.writeQuery<GetAnimeQuery>({
        query: GetAnimeDocument,
        variables: { id: route.params.id },
        data: {
          ...proxyData,
          Media: {
            ...proxyData?.Media,
            id: proxyData?.Media?.id as number,
            mediaListEntry: {
              ...(proxyData?.Media?.mediaListEntry as MediaList),
              score: (variables?.scoreRaw ?? 0) / 10,
            },
          },
        },
      });
    },
  });

  const updateProgress = useDebouncedMutation<
    UpdateProgressMutation,
    UpdateProgressMutationVariables
  >({
    mutationDocument: UpdateProgressDocument,
    makeUpdateFunction: (variables) => (proxy) => {
      // Read the data from our cache for this query.
      const proxyData = proxy.readQuery<GetAnimeQuery>({
        query: GetAnimeDocument,
        variables: { id: route.params.id },
      });

      // Write our data back to the cache with the new progress in it
      proxy.writeQuery<GetAnimeQuery>({
        query: GetAnimeDocument,
        variables: { id: route.params.id },
        data: {
          ...proxyData,
          Media: {
            ...proxyData?.Media,
            id: proxyData?.Media?.id as number,
            mediaListEntry: {
              ...(proxyData?.Media?.mediaListEntry as MediaList),
              progress: variables?.progress,
            },
          },
        },
      });

      if (variables?.progress === proxyData?.Media?.episodes) {
        // TODO: show dropdown alert to notify that this anime was moved to "completed" list
        setTimeout(refetchFromScroll, 1000);
      }
    },
  });

  async function refetchFromScroll() {
    setIsRefetchingFromScrollOrMount(true);
    await refetch({ id: route.params.id });
    setIsRefetchingFromScrollOrMount(false);
  }

  async function refetchSilently() {
    setIsRefetchingFromScrollOrMount(false);
    await refetch({ id: route.params.id });
  }

  const relations = (data?.Media?.relations?.edges ?? [])?.filter(notEmpty);

  const mappedRelations = _.reduce<
    typeof relations[number],
    { [K in MediaRelation]?: AnimeRelationFragmentFragment[] }
  >(
    relations,
    function (result, value, _key) {
      if (
        !value?.relationType ||
        !value.node ||
        !(value.node.type === MediaType.Anime)
      )
        return result;
      (result[value?.relationType] || (result[value?.relationType] = [])).push(
        value.node
      );
      return result;
    },
    {}
  );

  return (
    <Container
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetchingFromScrollOrMount && loading}
          onRefresh={refetchFromScroll}
          tintColor={darkTheme.text}
          titleColor={darkTheme.text}
        />
      }
    >
      {!data ? (
        !loading ? (
          <EmptyState />
        ) : null
      ) : (
        <>
          <Title numberOfLines={5}>
            {data?.Media?.title?.english ||
              data?.Media?.title?.romaji ||
              data?.Media?.title?.native}
          </Title>

          <PosterAndInfoContainer>
            <Poster
              resizeMode="cover"
              source={{
                uri: data?.Media?.coverImage?.large ?? "",
              }}
            />
            <InfoTable>
              <InfoRow>
                {data?.Media?.episodes ? (
                  <Info label="Episodes" value={`${data?.Media?.episodes}`} />
                ) : null}
                <Info
                  label="Genre"
                  value={data?.Media?.genres?.join(", ") ?? ""}
                />
              </InfoRow>
              <InfoRowSpacer />
              <InfoRow>
                {data?.Media?.averageScore ? (
                  <Info
                    label="Average score"
                    value={`${data?.Media?.averageScore / 10} / 10`}
                  />
                ) : null}
                <Info
                  label="Status"
                  value={title(
                    MediaStatusWithLabel.find(
                      (m) => m.value === data?.Media?.status
                    )?.label ?? ""
                  )}
                />
              </InfoRow>
              <InfoRowSpacer />
              <InfoRow>
                <Info
                  label="Progress"
                  value={`${data?.Media?.mediaListEntry?.progress ?? 0}/${
                    data?.Media?.episodes ?? "?"
                  } EP`}
                />
                {data?.Media?.status === MediaStatus.Releasing ? (
                  <Info
                    label="Next episode"
                    value={`EP ${
                      data?.Media?.nextAiringEpisode?.episode
                    } airs in ${formatDistanceToNow(
                      add(now, {
                        seconds:
                          data?.Media?.nextAiringEpisode?.timeUntilAiring ?? 0,
                      })
                    )}`}
                  />
                ) : null}

                {data?.Media?.status === MediaStatus.NotYetReleased
                  ? data?.Media?.startDate?.month !== null &&
                    data?.Media?.startDate?.month !== undefined && (
                      <Info
                        label="Start date"
                        value={`${data?.Media?.startDate?.month}/${data?.Media?.startDate?.month}/${data?.Media?.startDate?.year}`}
                      />
                    )
                  : null}

                {data?.Media?.status === MediaStatus.Finished ||
                data?.Media?.status === MediaStatus.Cancelled
                  ? data?.Media?.endDate?.month !== null &&
                    data?.Media?.endDate?.month !== undefined && (
                      <Info
                        label="End date"
                        value={`${data?.Media?.endDate?.month}/${data?.Media?.endDate?.month}/${data?.Media?.endDate?.year}`}
                      />
                    )
                  : null}
              </InfoRow>
            </InfoTable>
          </PosterAndInfoContainer>
          <ButtonsRow>
            <Button
              loading={loadingStatus}
              label={
                MediaListStatusWithLabel.find(
                  (x) => x.value === data?.Media?.mediaListEntry?.status
                )?.label ?? "Add to list"
              }
              onPress={() => {
                const options = MediaListStatusWithLabel.map((s) => s.label);

                options.push("Cancel");

                const destructiveButtonIndex = MediaListStatusWithLabel.findIndex(
                  (s) => s.value === data?.Media?.mediaListEntry?.status
                );

                const cancelButtonIndex = options.length - 1;

                showActionSheetWithOptions(
                  {
                    options,
                    destructiveButtonIndex,
                    cancelButtonIndex,
                    destructiveColor: darkTheme.accent,
                  },
                  async (buttonIndex) => {
                    if (buttonIndex === cancelButtonIndex) return;

                    setLoadingStatus(true);
                    await updateStatus({
                      mediaId: data?.Media?.id,
                      status: MediaListStatusWithLabel[buttonIndex].value,
                    });
                    await refetchSilently();
                    setLoadingStatus(false);
                  }
                );
              }}
            />
          </ButtonsRow>
          {data.Media?.mediaListEntry ? (
            <>
              <Stepper
                label="Progress"
                defaultValue={data?.Media?.mediaListEntry?.progress ?? 0}
                upperBound={data?.Media?.episodes ?? undefined}
                lowerBound={0}
                onChange={async (progress) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  try {
                    await updateProgress({
                      id: data?.Media?.mediaListEntry?.id,
                      progress,
                    });
                    await refetchSilently();
                  } catch (e) {
                    // TODO: display error
                    console.error(e);
                  }
                }}
              />
              <Stepper
                label="Score"
                defaultValue={data?.Media?.mediaListEntry?.score ?? 5}
                upperBound={10}
                lowerBound={0}
                onChange={async (s) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  try {
                    await updateScore({
                      id: data?.Media?.mediaListEntry?.id,
                      scoreRaw: s * 10,
                    });
                    await refetchSilently();
                  } catch (_e) {
                    // TODO: display error
                  }
                }}
              />
            </>
          ) : null}
          {data?.Media?.description ? (
            <HTMLView
              value={`<p>${data?.Media?.description}</p>`}
              stylesheet={htmlViewStyle}
            />
          ) : null}
          <DescriptionSpacer />
        </>
      )}
      {/* TODO: maybe this should be a flatlist */}
      {Object.keys(mappedRelations).map((key: string) => {
        const relationType = key as MediaRelation;
        const relations = mappedRelations[relationType] ?? [];

        return (
          <RelatedList
            key={key}
            relationType={relationType}
            relations={relations}
            navigation={navigation}
          />
        );
      })}

      <View style={{ height: 16 }} />
      <Text
        style={{
          fontFamily: Manrope.semiBold,
          color: darkTheme.text,
          fontSize: 20,
        }}
      >
        External / Streaming Links
      </Text>
      <View style={{ height: 16 }} />
      <FlatList
        data={data?.Media?.externalLinks?.filter(notEmpty)}
        keyExtractor={(item, index) => `${item.id}`}
        renderItem={({ item }) => <ExternalLink {...item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </Container>
  );
}

const DescriptionSpacer = takimoto.View({
  height: 16,
});

const htmlViewStyle = StyleSheet.create({
  // eslint-disable-next-line
  p: {
    color: darkTheme.text,
    fontFamily: Manrope.regular,
    fontSize: 16,
  },
  // eslint-disable-next-line
  i: {
    color: darkTheme.text,
    fontFamily: Manrope.regular,
    fontSize: 16,
  },
});